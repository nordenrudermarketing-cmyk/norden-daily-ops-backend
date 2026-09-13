import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// 職務類別 -> 自評題目類別對照（除了共同題目外，額外要加的專屬題目類別）
const ROLE_CATEGORY_MAP = { housekeeping: 'housekeeping', frontdesk: 'frontdesk', management: 'management', headquarters: 'management' };

// ============================================================
// 自評表時程（全部以台灣時間計算）
//
//   每月 1 號   系統發布「上個月」的自評表（例如 9/1 發布 8 月的表）
//   每月 10 號前 同仁完成填寫並送出
//   每月 20 號前 主管完成面談（在審閱頁按「完成面談」）
//
// 逾期只會標示提醒，不會擋住填寫或面談。
//
// Railway 伺服器跑在 UTC，直接用 new Date() 算日期的話，台灣時間 1 號早上 8 點以前
// 還會被當成上個月，所以日期一律先換算成台灣時間，前端也改用這裡回傳的日期判斷逾期。
// ============================================================
const SCHEDULE = { releaseDay: 1, staffDueDay: 10, interviewDueDay: 20 };

const taipeiFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
});

// 回傳台灣時間的 'YYYY-MM-DD'；沒給值就是今天
function taipeiDate(value = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(taipeiFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// '2026-08' 加減 n 個月
function addMonths(yearMonth, n) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const pad2 = (n) => String(n).padStart(2, '0');

// 今天應該填的是哪個月份的表（上個月的 1 號）
function currentEvalMonth() {
  return `${addMonths(taipeiDate().slice(0, 7), -1)}-01`;
}

// 接受 '2026-08' 或 '2026-08-01'，格式不對就回到目前這一期
function normalizeEvalMonth(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(value)) return `${value.slice(0, 7)}-01`;
  return currentEvalMonth();
}

function scheduleFor(evalMonth) {
  const next = addMonths(evalMonth.slice(0, 7), 1);
  return {
    eval_month: evalMonth,
    release_date: `${next}-${pad2(SCHEDULE.releaseDay)}`,
    staff_due_date: `${next}-${pad2(SCHEDULE.staffDueDay)}`,
    interview_due_date: `${next}-${pad2(SCHEDULE.interviewDueDay)}`,
  };
}

// GET /api/self-eval/schedule?eval_month=2026-08-01（選填，預設目前這一期）
// 前端要顯示期限、判斷逾期時用這支，不要自己用瀏覽器時間推算
router.get('/schedule', (req, res) => {
  const evalMonth = normalizeEvalMonth(req.query.eval_month);
  res.json({ ...scheduleFor(evalMonth), current_eval_month: currentEvalMonth(), today: taipeiDate() });
});

// ---------- 題目範本管理（總公司用）----------

// GET /api/self-eval/templates?category=xxx(選填)
router.get('/templates', async (req, res) => {
  const { category } = req.query;
  let query = supabase.from('self_eval_templates').select('*').order('category').order('sort_order');
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/self-eval/templates  { category, question_zh, question_id, sort_order }
router.post('/templates', async (req, res) => {
  const { data, error } = await supabase.from('self_eval_templates').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// PUT /api/self-eval/templates/:id
router.put('/templates/:id', async (req, res) => {
  const { id } = req.params;
  const { category, question_zh, question_id, sort_order } = req.body;
  const { data, error } = await supabase
    .from('self_eval_templates')
    .update({ category, question_zh, question_id, sort_order })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/self-eval/templates/:id/toggle  { is_active }
router.post('/templates/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  const { data, error } = await supabase.from('self_eval_templates').update({ is_active }).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------- 同仁填寫自評表 ----------

// GET /api/self-eval/form?staff_id=xxx&eval_month=2026-07-01（選填，預設目前這一期＝上個月）
router.get('/form', async (req, res) => {
  const { staff_id } = req.query;
  const evalMonth = normalizeEvalMonth(req.query.eval_month);

  const { data: staffRow, error: staffErr } = await supabase
    .from('staff')
    .select('id, name, branch_id, roles(category)')
    .eq('id', staff_id)
    .single();
  if (staffErr) return res.status(400).json({ error: staffErr.message });

  const roleCategory = ROLE_CATEGORY_MAP[staffRow.roles?.category] || null;
  const categories = roleCategory ? ['common', roleCategory] : ['common'];

  const { data: templates, error: tplErr } = await supabase
    .from('self_eval_templates')
    .select('*')
    .in('category', categories)
    .eq('is_active', true)
    .order('category')
    .order('sort_order');
  if (tplErr) return res.status(400).json({ error: tplErr.message });

  const { data: submission } = await supabase
    .from('self_eval_submissions')
    .select('*')
    .eq('staff_id', staff_id)
    .eq('eval_month', evalMonth)
    .maybeSingle();

  let answers = [];
  if (submission) {
    const { data } = await supabase.from('self_eval_answers').select('*').eq('submission_id', submission.id);
    answers = data ?? [];
  }
  const answerMap = {};
  answers.forEach((a) => { answerMap[a.template_id] = a; });

  const schedule = scheduleFor(evalMonth);

  res.json({
    staff: { id: staffRow.id, name: staffRow.name, branch_id: staffRow.branch_id },
    eval_month: evalMonth,
    due_date: schedule.staff_due_date, // 舊欄位名稱，自評提醒 banner 還在用
    staff_due_date: schedule.staff_due_date,
    interview_due_date: schedule.interview_due_date,
    release_date: schedule.release_date,
    today: taipeiDate(),
    submission: submission || null,
    questions: templates.map((t) => ({ ...t, answer: answerMap[t.id] || null })),
  });
});

// POST /api/self-eval/save
// { staff_id, branch_id, eval_month, answers: [{template_id, staff_answer, staff_note}], submit: true/false }
router.post('/save', async (req, res) => {
  const { staff_id, branch_id, answers, submit } = req.body;
  const evalMonth = normalizeEvalMonth(req.body.eval_month);
  const dueDate = scheduleFor(evalMonth).staff_due_date;

  const { data: submission, error: subErr } = await supabase
    .from('self_eval_submissions')
    .upsert(
      {
        staff_id, branch_id, eval_month: evalMonth,
        status: submit ? 'submitted' : 'draft',
        due_date: dueDate,
        submitted_at: submit ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'staff_id,eval_month' }
    )
    .select()
    .single();
  if (subErr) return res.status(400).json({ error: subErr.message });

  if (Array.isArray(answers) && answers.length > 0) {
    const rows = answers.map((a) => ({ submission_id: submission.id, ...a }));
    const { error: ansErr } = await supabase.from('self_eval_answers').upsert(rows, { onConflict: 'submission_id,template_id' });
    if (ansErr) return res.status(400).json({ error: ansErr.message });
  }

  res.json(submission);
});

// ---------- 店經理面談 ----------

// GET /api/self-eval/branch-overview?branch_id=xxx&eval_month=2026-07-01
router.get('/branch-overview', async (req, res) => {
  const { branch_id } = req.query;
  const evalMonth = normalizeEvalMonth(req.query.eval_month);

  const { data: staffList, error: staffErr } = await supabase
    .from('staff')
    .select('id, name, roles(name)')
    .eq('branch_id', branch_id)
    .eq('is_active', true);
  if (staffErr) return res.status(400).json({ error: staffErr.message });

  const { data: submissions } = await supabase
    .from('self_eval_submissions')
    .select('id, staff_id, status, submitted_at, due_date, interview_date, manager_signed_at')
    .eq('branch_id', branch_id)
    .eq('eval_month', evalMonth);

  const subMap = {};
  (submissions ?? []).forEach((s) => { subMap[s.staff_id] = s; });

  res.json(staffList.map((s) => ({
    staff_id: s.id,
    name: s.name,
    role_name: s.roles?.name,
    submission: subMap[s.id] || null,
  })));
});

// GET /api/self-eval/submission-detail?submission_id=xxx
router.get('/submission-detail', async (req, res) => {
  const { submission_id } = req.query;

  const { data: submission, error } = await supabase
    .from('self_eval_submissions')
    .select('*, staff:staff_id(name)')
    .eq('id', submission_id)
    .single();
  if (error) return res.status(400).json({ error: error.message });

  const { data: answers } = await supabase
    .from('self_eval_answers')
    .select('*, template:template_id(category, question_zh, question_id, sort_order)')
    .eq('submission_id', submission_id);

  const sorted = (answers ?? []).sort((a, b) => (a.template?.sort_order ?? 0) - (b.template?.sort_order ?? 0));

  res.json({ submission, answers: sorted });
});

// POST /api/self-eval/manager-review
// { submission_id, answers: [{template_id, manager_answer, manager_note}], interview_notes, interview_date, mark_reviewed }
// mark_reviewed = true 代表「完成面談」，完成後這份表就鎖定
router.post('/manager-review', async (req, res) => {
  const { submission_id, answers, interview_notes, interview_date, mark_reviewed } = req.body;

  const { data: current, error: curErr } = await supabase
    .from('self_eval_submissions')
    .select('id, status')
    .eq('id', submission_id)
    .single();
  if (curErr) return res.status(400).json({ error: curErr.message });
  if (current.status === 'reviewed') {
    return res.status(400).json({ error: '這份自評表已經完成面談，不能再修改' });
  }
  // 面談是在同仁送出之後才進行，還是草稿的表不能被主管鎖定
  if (mark_reviewed && current.status !== 'submitted') {
    return res.status(400).json({ error: '同仁還沒送出自評表，不能完成面談' });
  }

  if (Array.isArray(answers)) {
    for (const a of answers) {
      await supabase
        .from('self_eval_answers')
        .update({ manager_answer: a.manager_answer, manager_note: a.manager_note })
        .eq('submission_id', submission_id)
        .eq('template_id', a.template_id);
    }
  }

  const updatePayload = {
    manager_interview_notes: interview_notes,
    interview_date: interview_date || null,
    updated_at: new Date().toISOString(),
  };
  if (mark_reviewed) {
    updatePayload.status = 'reviewed';
    updatePayload.manager_signed_at = new Date().toISOString();
    if (!updatePayload.interview_date) updatePayload.interview_date = taipeiDate();
  }

  const { data, error } = await supabase
    .from('self_eval_submissions')
    .update(updatePayload)
    .eq('id', submission_id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------- 總公司：各館自評進度 ----------

// 一位同仁在某一期的進度
function progressRow(person, sub, schedule, today) {
  const submitted = sub?.status === 'submitted' || sub?.status === 'reviewed';
  const reviewed = sub?.status === 'reviewed';
  const submittedOn = submitted ? taipeiDate(sub.submitted_at) : null;
  const reviewedOn = reviewed ? taipeiDate(sub.manager_signed_at) : null;
  return {
    staff_id: person.staff_id,
    name: person.name,
    role_name: person.role_name,
    inactive: !!person.inactive,
    // 同仁填寫：done 已送出 / draft 草稿 / not_started 尚未開始
    fill_status: submitted ? 'done' : sub ? 'draft' : 'not_started',
    submitted_on: submittedOn,
    submitted_late: !!submittedOn && submittedOn > schedule.staff_due_date,
    fill_overdue: !submitted && today > schedule.staff_due_date,
    // 主管面談：done 已完成 / pending 還沒
    interview_status: reviewed ? 'done' : 'pending',
    interview_date: sub?.interview_date || null,
    reviewed_on: reviewedOn,
    reviewed_late: !!reviewedOn && reviewedOn > schedule.interview_due_date,
    interview_overdue: !reviewed && today > schedule.interview_due_date,
  };
}

// GET /api/self-eval/hq-progress?eval_month=2026-08-01（選填，預設目前這一期）
// 每個館「同仁填寫」「主管面談」兩個階段的完成人數，以及每位同仁的狀態。
// 不回傳作答內容——勾「否」不代表異常，那是同仁跟主管面談改善的起點。
router.get('/hq-progress', async (req, res) => {
  const evalMonth = normalizeEvalMonth(req.query.eval_month);
  const schedule = scheduleFor(evalMonth);
  const today = taipeiDate();
  const current = currentEvalMonth();

  const [branchesRes, staffRes, subsRes, earliestRes] = await Promise.all([
    supabase.from('branches').select('id, name, code'),
    supabase.from('staff').select('id, name, branch_id, roles(name)').eq('is_active', true),
    supabase
      .from('self_eval_submissions')
      .select('staff_id, branch_id, status, submitted_at, interview_date, manager_signed_at, staff:staff_id(name, roles(name))')
      .eq('eval_month', evalMonth),
    supabase.from('self_eval_submissions').select('eval_month').order('eval_month', { ascending: true }).limit(1),
  ]);
  const err = branchesRes.error || staffRes.error || subsRes.error || earliestRes.error;
  if (err) return res.status(400).json({ error: err.message });

  // 月份選項：從最早有人填的那一期到目前這一期（最多 24 期），新的在前
  const earliest = earliestRes.data?.[0]?.eval_month?.slice(0, 7);
  const months = [];
  for (let ym = current.slice(0, 7); months.length < 24; ym = addMonths(ym, -1)) {
    months.push(`${ym}-01`);
    if (!earliest || ym <= earliest) break;
  }
  if (!months.includes(evalMonth)) months.push(evalMonth);
  months.sort().reverse();

  // 應填名單：目前在職的同仁，加上這一期有填過但之後停用的同仁（歷史月份才不會少算）
  // 館別以填寫當時存下來的為準，還沒填的就用目前所屬館別
  const people = new Map();
  for (const s of staffRes.data) {
    people.set(s.id, { staff_id: s.id, name: s.name, role_name: s.roles?.name || null, branch_id: s.branch_id });
  }
  const subByStaff = new Map();
  for (const sub of subsRes.data) {
    subByStaff.set(sub.staff_id, sub);
    const person = people.get(sub.staff_id);
    if (person) {
      if (sub.branch_id) person.branch_id = sub.branch_id;
    } else {
      people.set(sub.staff_id, {
        staff_id: sub.staff_id,
        name: sub.staff?.name || '（已停用的同仁）',
        role_name: sub.staff?.roles?.name || null,
        branch_id: sub.branch_id,
        inactive: true,
      });
    }
  }

  const branches = branchesRes.data
    .map((b) => {
      const staff = [...people.values()]
        .filter((p) => p.branch_id === b.id)
        .map((p) => progressRow(p, subByStaff.get(p.staff_id), schedule, today))
        .sort((x, y) => x.name.localeCompare(y.name, 'zh-Hant'));
      return {
        branch_id: b.id,
        branch_name: b.name,
        is_hq: b.code === 'HQ',
        total: staff.length,
        fill_done: staff.filter((s) => s.fill_status === 'done').length,
        interview_done: staff.filter((s) => s.interview_status === 'done').length,
        fill_overdue: staff.filter((s) => s.fill_overdue).length,
        interview_overdue: staff.filter((s) => s.interview_overdue).length,
        staff,
      };
    })
    // 總公司自己排最後，其他館依名稱
    .sort((a, b) => Number(a.is_hq) - Number(b.is_hq) || a.branch_name.localeCompare(b.branch_name, 'zh-Hant'));

  res.json({ ...schedule, today, current_eval_month: current, months, branches });
});

export default router;
