import express from 'express';
import { supabase } from '../supabaseClient.js';
import { loadActor, levelOf, isLeadOrAbove } from '../lib/roleLevel.js';
import { taipeiDate } from '../lib/taiwanTime.js';

const router = express.Router();

// ============================================================
// 待辦事項追蹤（取代舊的「總公司交辦任務」）
//
// 誰可以派任務：副理（含）以上。不能往上派：
//   總公司：任何人
//   店經理：自己館別的任何人（總公司除外）
//   店副理：自己館別的店副理（含自己）、房務、客務
//
// 「我派發的任務」：派發方館別（owner_branch_id）跟自己相同的任務。
//   總公司帳號都屬於「總公司」館別，所以總公司看得到所有總公司帳號派的任務；
//   店經理、店副理看得到自己館別派的任務。
//   這一方可以：改執行人、更新進度、暫緩／恢復、檢核結案、退回。
//
// 「我的任務」：執行人是自己的任務。可以：更新進度、完成待檢查。
//
// 狀態：in_progress 執行中 → pending_review 完成待檢查 → done 已結案
//       另外可以 on_hold 暫緩執行（再恢復回 in_progress）
//       「檢核結案」一定要執行人先按「完成待檢查」之後才能按（後端也會擋）
//
// 所有 API 都要帶 ?actor_id=，權限由後端查資料庫裡的真實職務判斷。
// ============================================================

const STATUS = { IN_PROGRESS: 'in_progress', PENDING_REVIEW: 'pending_review', ON_HOLD: 'on_hold', DONE: 'done' };

// 已結案的任務只回傳最近這麼多筆，避免清單越來越長
const DONE_LIMIT = 50;

const TASK_COLUMNS = `
  id, title, description, due_date, status, owner_branch_id, created_by, assignee_id,
  submitted_at, closed_at, created_at, updated_at,
  owner_branch:owner_branch_id(name),
  creator:created_by(name),
  assignee:assignee_id(name, branches(name)),
  closer:closed_by(name),
  updates:todo_task_updates(id, update_date, note, kind, created_at, author:created_by(name))
`;

const STAFF_COLUMNS = 'id, name, branch_id, is_active, branches(name), roles(name, category)';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// 'YYYY-MM-DD' 格式對就用，不對就回 null
function cleanDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// 這個人可以把任務派給 target 嗎？
function canAssignTo(actor, target) {
  if (!target || target.is_active === false) return false;
  const targetLevel = levelOf(target.roles?.name);
  if (actor.level === 'hq') return true;
  if (target.branch_id !== actor.branch_id) return false;
  if (actor.level === 'manager') return targetLevel !== 'hq';
  if (actor.level === 'deputy') return targetLevel === 'deputy' || targetLevel === 'staff';
  return false;
}

// 是不是派發這一方（副理以上、而且是同一個派發館別）
function isOwnerSide(actor, task) {
  return isLeadOrAbove(actor.level) && task.owner_branch_id === actor.branch_id;
}

function isAssignee(actor, task) {
  return task.assignee_id === actor.id;
}

// 回傳給前端的樣子
function toPublic(actor, t) {
  const updates = (t.updates || [])
    .map((u) => ({
      id: u.id,
      update_date: u.update_date,
      note: u.note,
      kind: u.kind,
      author_name: u.author?.name || null,
      created_at: u.created_at,
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); // 新的在上面
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    status: t.status,
    owner_branch_name: t.owner_branch?.name || null,
    creator_name: t.creator?.name || null,
    assignee_id: t.assignee_id,
    assignee_name: t.assignee?.name || null,
    assignee_branch_name: t.assignee?.branches?.name || null,
    closer_name: t.closer?.name || null,
    submitted_at: t.submitted_at,
    closed_at: t.closed_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
    last_update_date: updates.find((u) => u.kind === 'progress')?.update_date || null,
    updates,
    can_manage: isOwnerSide(actor, t),
    is_mine: isAssignee(actor, t),
  };
}

// 未結案的全部 + 最近結案的 DONE_LIMIT 筆
async function listTasks(actor, column, value) {
  const [activeRes, doneRes] = await Promise.all([
    supabase.from('todo_tasks').select(TASK_COLUMNS).eq(column, value).neq('status', STATUS.DONE)
      .order('created_at', { ascending: false }),
    supabase.from('todo_tasks').select(TASK_COLUMNS).eq(column, value).eq('status', STATUS.DONE)
      .order('closed_at', { ascending: false }).limit(DONE_LIMIT),
  ]);
  const error = activeRes.error || doneRes.error;
  if (error) return { error };
  return { tasks: [...activeRes.data, ...doneRes.data].map((t) => toPublic(actor, t)) };
}

async function loadTask(id) {
  const { data } = await supabase.from('todo_tasks').select(TASK_COLUMNS).eq('id', id).maybeSingle();
  return data;
}

async function loadStaff(id) {
  if (!id) return null;
  const { data } = await supabase.from('staff').select(STAFF_COLUMNS).eq('id', id).maybeSingle();
  return data;
}

async function addLog(taskId, actor, kind, note, updateDate = taipeiDate()) {
  return supabase.from('todo_task_updates').insert({
    task_id: taskId, update_date: updateDate, note, kind, created_by: actor.id,
  });
}

async function respondWithTask(res, actor, id) {
  const fresh = await loadTask(id);
  if (!fresh) return res.json({ ok: true });
  res.json(toPublic(actor, fresh));
}

// ------------------------------------------------------------
// 每一支都要先確認「目前登入的是誰」
// ------------------------------------------------------------
router.use(async (req, res, next) => {
  const actor = await loadActor(req.query.actor_id);
  if (!actor) return res.status(403).json({ error: '找不到目前登入的帳號，請重新登入' });
  req.actor = actor;
  next();
});

// GET /api/todos/meta?actor_id=
// 能不能派任務、可以派給誰、台灣時間的今天（更新進度的日期預設值）
router.get('/meta', async (req, res) => {
  const { actor } = req;
  const canDispatch = isLeadOrAbove(actor.level);

  let assignees = [];
  if (canDispatch) {
    let query = supabase.from('staff').select(STAFF_COLUMNS).eq('is_active', true);
    if (actor.level !== 'hq') query = query.eq('branch_id', actor.branch_id);
    const { data, error } = await query.order('name');
    if (error) return res.status(400).json({ error: error.message });
    assignees = data
      .filter((s) => canAssignTo(actor, s))
      .map((s) => ({ id: s.id, name: s.name, role_name: s.roles?.name || null, branch_name: s.branches?.name || null }))
      .sort((a, b) => (a.branch_name || '').localeCompare(b.branch_name || '', 'zh-Hant') || a.name.localeCompare(b.name, 'zh-Hant'));
  }

  res.json({
    actor: { id: actor.id, name: actor.name, level: actor.level },
    can_dispatch: canDispatch,
    assignees,
    today: taipeiDate(),
    done_limit: DONE_LIMIT,
  });
});

// GET /api/todos/dispatched?actor_id=   我派發的任務（副理以上）
router.get('/dispatched', async (req, res) => {
  const { actor } = req;
  if (!isLeadOrAbove(actor.level)) return res.status(403).json({ error: '只有副理以上可以派發任務' });
  const { tasks, error } = await listTasks(actor, 'owner_branch_id', actor.branch_id);
  if (error) return res.status(400).json({ error: error.message });
  res.json(tasks);
});

// GET /api/todos/mine?actor_id=   我的任務（執行人是自己）
router.get('/mine', async (req, res) => {
  const { actor } = req;
  const { tasks, error } = await listTasks(actor, 'assignee_id', actor.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json(tasks);
});

// POST /api/todos?actor_id=   { title, description, due_date, assignee_id }
router.post('/', async (req, res) => {
  const { actor } = req;
  if (!isLeadOrAbove(actor.level)) return res.status(403).json({ error: '只有副理以上可以派發任務' });

  const title = cleanText(req.body.title);
  if (!title) return res.status(400).json({ error: '請填寫任務名稱' });

  const assignee = await loadStaff(req.body.assignee_id);
  if (!assignee) return res.status(400).json({ error: '請選擇執行人' });
  if (!canAssignTo(actor, assignee)) return res.status(403).json({ error: '你不能把任務派給這位同仁' });

  const { data, error } = await supabase
    .from('todo_tasks')
    .insert({
      title,
      description: cleanText(req.body.description) || null,
      due_date: cleanDate(req.body.due_date),
      status: STATUS.IN_PROGRESS,
      owner_branch_id: actor.branch_id,
      created_by: actor.id,
      assignee_id: assignee.id,
    })
    .select('id')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  respondWithTask(res, actor, data.id);
});

// 下面這幾支都要先找到任務，並確認這個人跟任務的關係
async function withTask(req, res, check) {
  const task = await loadTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: '找不到這個任務，可能已被刪除' });
    return null;
  }
  const denied = check(req.actor, task);
  if (denied) {
    res.status(403).json({ error: denied });
    return null;
  }
  return task;
}

const OWNER_ONLY = (actor, task) => (isOwnerSide(actor, task) ? null : '只有派發這個任務的主管可以操作');

// PUT /api/todos/:id/assignee?actor_id=   { assignee_id }
router.put('/:id/assignee', async (req, res) => {
  const { actor } = req;
  const task = await withTask(req, res, OWNER_ONLY);
  if (!task) return;
  if (task.status === STATUS.DONE) return res.status(400).json({ error: '已結案的任務不能更換執行人' });

  const assignee = await loadStaff(req.body.assignee_id);
  if (!assignee) return res.status(400).json({ error: '請選擇執行人' });
  if (!canAssignTo(actor, assignee)) return res.status(403).json({ error: '你不能把任務派給這位同仁' });
  if (assignee.id === task.assignee_id) return respondWithTask(res, actor, task.id);

  const { error } = await supabase
    .from('todo_tasks')
    .update({ assignee_id: assignee.id, updated_at: new Date().toISOString() })
    .eq('id', task.id);
  if (error) return res.status(400).json({ error: error.message });

  await addLog(task.id, actor, 'assign', `執行人由「${task.assignee?.name || '—'}」改為「${assignee.name}」`);
  respondWithTask(res, actor, task.id);
});

// POST /api/todos/:id/updates?actor_id=   { update_date, note }
// 更新進度：派發方和執行人都可以寫
router.post('/:id/updates', async (req, res) => {
  const { actor } = req;
  const task = await withTask(req, res, (a, t) =>
    isOwnerSide(a, t) || isAssignee(a, t) ? null : '你不是這個任務的派發主管或執行人');
  if (!task) return;
  if (task.status === STATUS.DONE) return res.status(400).json({ error: '已結案的任務不能再更新進度' });

  const note = cleanText(req.body.note);
  if (!note) return res.status(400).json({ error: '請填寫進度簡述' });

  const { error } = await addLog(task.id, actor, 'progress', note, cleanDate(req.body.update_date) || taipeiDate());
  if (error) return res.status(400).json({ error: error.message });
  await supabase.from('todo_tasks').update({ updated_at: new Date().toISOString() }).eq('id', task.id);
  respondWithTask(res, actor, task.id);
});

// 狀態變更共用：確認身分與目前狀態 → 更新 → 記一筆紀錄
// 更新時也帶上「目前狀態」當條件，兩個人同時按的時候只有一個會成功
function transition({ from, to, who, kind, defaultNote, requireNote, extra, wrongStatus }) {
  return async (req, res) => {
    const { actor } = req;
    const task = await withTask(req, res, who);
    if (!task) return;
    if (!from.includes(task.status)) return res.status(400).json({ error: wrongStatus });

    const note = cleanText(req.body?.note);
    if (requireNote && !note) return res.status(400).json({ error: requireNote });

    const { data, error } = await supabase
      .from('todo_tasks')
      .update({ status: to, updated_at: new Date().toISOString(), ...(extra ? extra(actor) : {}) })
      .eq('id', task.id)
      .eq('status', task.status)
      .select('id');
    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(409).json({ error: '這個任務剛剛被別人更新過，請重新整理後再試' });
    }

    await addLog(task.id, actor, kind, note ? `${defaultNote}：${note}` : defaultNote);
    respondWithTask(res, actor, task.id);
  };
}

// POST /api/todos/:id/hold?actor_id=   { note? }   暫緩執行
router.post('/:id/hold', transition({
  from: [STATUS.IN_PROGRESS, STATUS.PENDING_REVIEW],
  to: STATUS.ON_HOLD,
  who: OWNER_ONLY,
  kind: 'hold',
  defaultNote: '暫緩執行',
  extra: () => ({ submitted_at: null }),
  wrongStatus: '只有正在執行的任務可以暫緩',
}));

// POST /api/todos/:id/resume?actor_id=   { note? }   恢復執行
router.post('/:id/resume', transition({
  from: [STATUS.ON_HOLD],
  to: STATUS.IN_PROGRESS,
  who: OWNER_ONLY,
  kind: 'resume',
  defaultNote: '恢復執行',
  wrongStatus: '只有暫緩中的任務可以恢復執行',
}));

// POST /api/todos/:id/submit?actor_id=   { note? }   執行人：完成待檢查
router.post('/:id/submit', transition({
  from: [STATUS.IN_PROGRESS],
  to: STATUS.PENDING_REVIEW,
  who: (actor, task) => (isAssignee(actor, task) ? null : '只有這個任務的執行人可以按「完成待檢查」'),
  kind: 'submit',
  defaultNote: '完成，待檢查',
  extra: () => ({ submitted_at: new Date().toISOString() }),
  wrongStatus: '只有執行中的任務可以按「完成待檢查」',
}));

// POST /api/todos/:id/close?actor_id=   { note? }   上級：檢核結案（執行人要先按完成待檢查）
router.post('/:id/close', transition({
  from: [STATUS.PENDING_REVIEW],
  to: STATUS.DONE,
  who: OWNER_ONLY,
  kind: 'close',
  defaultNote: '檢核結案',
  extra: (actor) => ({ closed_at: new Date().toISOString(), closed_by: actor.id }),
  wrongStatus: '執行人還沒按「完成待檢查」，不能檢核結案',
}));

// POST /api/todos/:id/reject?actor_id=   { note }   上級：退回，改回執行中
router.post('/:id/reject', transition({
  from: [STATUS.PENDING_REVIEW],
  to: STATUS.IN_PROGRESS,
  who: OWNER_ONLY,
  kind: 'reject',
  defaultNote: '退回',
  requireNote: '請填寫退回原因，讓執行人知道要補什麼',
  extra: () => ({ submitted_at: null }),
  wrongStatus: '只有待檢查的任務可以退回',
}));

export default router;
