import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// ============================================================
// 帳號管理（總公司、店經理用）
//
// ⚠ 這組 API 沒有真正的登入驗證（2026-09-13 決定「先只做畫面」）。
//   actor_id 是前端送來的「目前登入的是誰」，後端會拿它去資料庫查這個人真實的職務與館別，
//   再照下面的規則判斷能不能做。這可以擋住畫面上的越權操作，
//   但擋不住知道 API 的人自己偽造 actor_id。要真正防堵，需要另外加上登入驗證。
//
// 權限規則：
//   總公司：所有館別、所有職務的帳號都能管理
//   店經理：只能管理「自己館別」的「房務、客務」帳號；自己的帳號只能改密碼
//   其他人：不能使用
//
// 刪除：一律先「停用」（不能登入，但所有紀錄保留，之後可以再啟用）。
//   只有「已停用」而且「從來沒設定過密碼」的帳號才能永久刪除（通常是建錯的帳號）。
//
// 密碼：資料庫只存 bcrypt 雜湊，任何 API 都不會回傳密碼或雜湊值。
// ============================================================

// 店經理可以管理的職務類別
const GENERAL_CATEGORIES = ['housekeeping', 'frontdesk'];

// 這三張表指向 staff 的外鍵是 on delete cascade（schema_v4 / v6 / v7），
// 刪帳號會把裡面的資料一起刪掉，所以永久刪除前要先確認是空的
const CASCADE_TABLES = [
  { table: 'staff_schedule', label: '排班紀錄' },
  { table: 'staff_learning_progress', label: '培訓進度' },
  { table: 'assessment_stage_evaluations', label: '階段考核' },
];

const ACCOUNT_COLUMNS =
  'id, name, login_code, branch_id, role_id, is_active, is_part_time, password_hash, branches(name), roles(name, category)';

function levelOf(roleName) {
  if (roleName === '總公司') return 'hq';
  if (roleName === '店經理') return 'manager';
  return 'none';
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canManage(actor, target) {
  if (actor.level === 'hq') return true;
  return (
    actor.level === 'manager' &&
    target.branch_id === actor.branch_id &&
    GENERAL_CATEGORIES.includes(target.roles?.category)
  );
}

// 回傳給前端的樣子：不含 password_hash，並附上「這個主管對這個帳號能做什麼」
function toPublic(actor, s) {
  const manageable = canManage(actor, s);
  const isSelf = s.id === actor.id;
  const hasPassword = !!s.password_hash;
  const isActive = s.is_active !== false;
  return {
    id: s.id,
    name: s.name,
    login_code: s.login_code,
    branch_id: s.branch_id,
    branch_name: s.branches?.name || null,
    role_id: s.role_id,
    role_name: s.roles?.name || null,
    role_category: s.roles?.category || null,
    is_active: isActive,
    is_part_time: !!s.is_part_time,
    has_password: hasPassword,
    is_self: isSelf,
    can_edit: manageable,
    can_set_password: manageable || isSelf,
    can_deactivate: manageable && !isSelf,
    can_hard_delete: manageable && !isSelf && !isActive && !hasPassword,
  };
}

async function loadTarget(id) {
  const { data } = await supabase.from('staff').select(ACCOUNT_COLUMNS).eq('id', id).maybeSingle();
  return data;
}

// 登入時是用 login_code + .single() 查詢，重複的話兩個人都會登入不了，所以一律不准重複（含已停用的）
async function loginCodeTaken(code, exceptId = null) {
  const { data } = await supabase.from('staff').select('id').eq('login_code', code);
  return (data || []).some((s) => s.id !== exceptId);
}

// 決定新增／修改時實際要寫入的館別與職務（店經理的館別一律強制為自己的館別）
async function resolveScope(actor, branchId, roleId) {
  if (!roleId) return { error: '請選擇職務' };
  const { data: role } = await supabase.from('roles').select('id, name, category').eq('id', roleId).maybeSingle();
  if (!role) return { error: '請選擇職務' };

  if (actor.level === 'manager') {
    if (!GENERAL_CATEGORIES.includes(role.category)) {
      return { error: '店經理只能設定房務或客務職務的帳號' };
    }
    return { branch_id: actor.branch_id, role };
  }

  if (!branchId) return { error: '請選擇館別' };
  const { data: branch } = await supabase.from('branches').select('id').eq('id', branchId).maybeSingle();
  if (!branch) return { error: '請選擇館別' };
  return { branch_id: branch.id, role };
}

// 避免把最後一個啟用中的總公司帳號停用或改掉職務，否則就沒有人能再進後台了
async function isLastActiveHQ(target) {
  if (target.roles?.name !== '總公司' || target.is_active === false) return false;
  const { data } = await supabase
    .from('staff')
    .select('id, roles!inner(name)')
    .eq('roles.name', '總公司')
    .eq('is_active', true);
  return !(data || []).some((s) => s.id !== target.id);
}

async function respondWithAccount(res, actor, id) {
  const fresh = await loadTarget(id);
  if (!fresh) return res.json({ ok: true });
  res.json(toPublic(actor, fresh));
}

// ------------------------------------------------------------
// 每一支都要先確認「目前登入的是誰、有沒有權限用帳號管理」
// ------------------------------------------------------------
router.use(async (req, res, next) => {
  const actorId = req.query.actor_id;
  if (!actorId) return res.status(403).json({ error: '請先登入' });

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, branch_id, is_active, roles(name, category)')
    .eq('id', actorId)
    .maybeSingle();
  if (error || !data || data.is_active === false) {
    return res.status(403).json({ error: '找不到目前登入的帳號，請重新登入' });
  }

  const level = levelOf(data.roles?.name);
  if (level === 'none') return res.status(403).json({ error: '帳號管理只有總公司和店經理可以使用' });

  req.actor = { ...data, level };
  next();
});

// GET /api/accounts/meta?actor_id=
// 這個主管可以選的館別、職務（新增／編輯表單的下拉選單用）
router.get('/meta', async (req, res) => {
  const { actor } = req;
  const [branchesRes, rolesRes] = await Promise.all([
    supabase.from('branches').select('id, name, code').order('name'),
    supabase.from('roles').select('id, name, category').order('name'),
  ]);
  const err = branchesRes.error || rolesRes.error;
  if (err) return res.status(400).json({ error: err.message });

  const isHQ = actor.level === 'hq';
  res.json({
    actor: { id: actor.id, name: actor.name, level: actor.level, branch_id: actor.branch_id },
    branches: isHQ ? branchesRes.data : branchesRes.data.filter((b) => b.id === actor.branch_id),
    roles: isHQ ? rolesRes.data : rolesRes.data.filter((r) => GENERAL_CATEGORIES.includes(r.category)),
  });
});

// GET /api/accounts?actor_id=
// 這個主管能管理的帳號（含已停用的；前端自己決定要不要顯示），自己的帳號也會列出來方便改密碼
router.get('/', async (req, res) => {
  const { actor } = req;
  let query = supabase.from('staff').select(ACCOUNT_COLUMNS);
  if (actor.level === 'manager') query = query.eq('branch_id', actor.branch_id);

  const { data, error } = await query.order('name');
  if (error) return res.status(400).json({ error: error.message });

  res.json(
    data
      .filter((s) => canManage(actor, s) || s.id === actor.id)
      .map((s) => toPublic(actor, s))
  );
});

// POST /api/accounts?actor_id=  { name, login_code, branch_id, role_id, is_part_time, password? }
router.post('/', async (req, res) => {
  const { actor } = req;
  const name = cleanText(req.body.name);
  const loginCode = cleanText(req.body.login_code);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!name) return res.status(400).json({ error: '請填寫姓名' });
  if (!loginCode) return res.status(400).json({ error: '請填寫登入代碼' });

  const scope = await resolveScope(actor, req.body.branch_id, req.body.role_id);
  if (scope.error) return res.status(400).json({ error: scope.error });
  if (await loginCodeTaken(loginCode)) {
    return res.status(400).json({ error: `登入代碼「${loginCode}」已經有人使用` });
  }

  const row = {
    name,
    login_code: loginCode,
    branch_id: scope.branch_id,
    role_id: scope.role.id,
    is_active: true,
    is_part_time: !!req.body.is_part_time,
    // 沒給密碼就留空：同仁第一次登入時輸入的密碼會直接變成他的密碼（跟既有行為一致）
    password_hash: password.trim() ? await bcrypt.hash(password, 10) : null,
  };

  const { data, error } = await supabase.from('staff').insert(row).select('id').single();
  if (error) {
    const msg = error.code === '23505' ? `登入代碼「${loginCode}」已經有人使用` : error.message;
    return res.status(400).json({ error: msg });
  }
  respondWithAccount(res, actor, data.id);
});

// PUT /api/accounts/:id?actor_id=  { name, login_code, branch_id, role_id, is_part_time }
router.put('/:id', async (req, res) => {
  const { actor } = req;
  const target = await loadTarget(req.params.id);
  if (!target) return res.status(404).json({ error: '找不到這個帳號' });
  if (!canManage(actor, target)) return res.status(403).json({ error: '你沒有權限修改這個帳號' });

  const name = cleanText(req.body.name);
  const loginCode = cleanText(req.body.login_code);
  if (!name) return res.status(400).json({ error: '請填寫姓名' });
  if (!loginCode) return res.status(400).json({ error: '請填寫登入代碼' });

  const scope = await resolveScope(actor, req.body.branch_id, req.body.role_id);
  if (scope.error) return res.status(400).json({ error: scope.error });

  if (target.id === actor.id && scope.role.id !== target.role_id) {
    return res.status(400).json({ error: '不能修改自己的職務，避免把自己鎖在後台外面' });
  }
  if (scope.role.name !== '總公司' && (await isLastActiveHQ(target))) {
    return res.status(400).json({ error: '這是最後一個啟用中的總公司帳號，不能改成其他職務' });
  }
  if (await loginCodeTaken(loginCode, target.id)) {
    return res.status(400).json({ error: `登入代碼「${loginCode}」已經有人使用` });
  }

  const { error } = await supabase
    .from('staff')
    .update({
      name,
      login_code: loginCode,
      branch_id: scope.branch_id,
      role_id: scope.role.id,
      is_part_time: !!req.body.is_part_time,
    })
    .eq('id', target.id);
  if (error) {
    const msg = error.code === '23505' ? `登入代碼「${loginCode}」已經有人使用` : error.message;
    return res.status(400).json({ error: msg });
  }
  respondWithAccount(res, actor, target.id);
});

// POST /api/accounts/:id/password?actor_id=  { password }
// 主管幫同仁設定新密碼，或任何主管修改自己的密碼
router.post('/:id/password', async (req, res) => {
  const { actor } = req;
  const target = await loadTarget(req.params.id);
  if (!target) return res.status(404).json({ error: '找不到這個帳號' });
  if (!canManage(actor, target) && target.id !== actor.id) {
    return res.status(403).json({ error: '你沒有權限修改這個帳號的密碼' });
  }

  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!password.trim()) return res.status(400).json({ error: '請輸入新密碼' });

  const hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('staff').update({ password_hash: hash }).eq('id', target.id);
  if (error) return res.status(400).json({ error: error.message });
  respondWithAccount(res, actor, target.id);
});

// POST /api/accounts/:id/reset-password?actor_id=
// 清空密碼：對方下次登入時輸入的密碼會直接變成新密碼
router.post('/:id/reset-password', async (req, res) => {
  const { actor } = req;
  const target = await loadTarget(req.params.id);
  if (!target) return res.status(404).json({ error: '找不到這個帳號' });
  if (!canManage(actor, target)) return res.status(403).json({ error: '你沒有權限清空這個帳號的密碼' });

  const { error } = await supabase.from('staff').update({ password_hash: null }).eq('id', target.id);
  if (error) return res.status(400).json({ error: error.message });
  respondWithAccount(res, actor, target.id);
});

// POST /api/accounts/:id/deactivate?actor_id=
router.post('/:id/deactivate', async (req, res) => {
  const { actor } = req;
  const target = await loadTarget(req.params.id);
  if (!target) return res.status(404).json({ error: '找不到這個帳號' });
  if (!canManage(actor, target)) return res.status(403).json({ error: '你沒有權限停用這個帳號' });
  if (target.id === actor.id) return res.status(400).json({ error: '不能停用自己的帳號' });
  if (await isLastActiveHQ(target)) {
    return res.status(400).json({ error: '這是最後一個啟用中的總公司帳號，不能停用' });
  }

  const { error } = await supabase.from('staff').update({ is_active: false }).eq('id', target.id);
  if (error) return res.status(400).json({ error: error.message });
  respondWithAccount(res, actor, target.id);
});

// POST /api/accounts/:id/activate?actor_id=
router.post('/:id/activate', async (req, res) => {
  const { actor } = req;
  const target = await loadTarget(req.params.id);
  if (!target) return res.status(404).json({ error: '找不到這個帳號' });
  if (!canManage(actor, target)) return res.status(403).json({ error: '你沒有權限啟用這個帳號' });

  const { error } = await supabase.from('staff').update({ is_active: true }).eq('id', target.id);
  if (error) return res.status(400).json({ error: error.message });
  respondWithAccount(res, actor, target.id);
});

// DELETE /api/accounts/:id?actor_id=
// 永久刪除：只限「已停用」且「從來沒設定過密碼」的帳號，而且會連帶刪除的紀錄必須是空的
router.delete('/:id', async (req, res) => {
  const { actor } = req;
  const target = await loadTarget(req.params.id);
  if (!target) return res.status(404).json({ error: '找不到這個帳號' });
  if (!canManage(actor, target)) return res.status(403).json({ error: '你沒有權限刪除這個帳號' });
  if (target.id === actor.id) return res.status(400).json({ error: '不能刪除自己的帳號' });
  if (target.is_active !== false) {
    return res.status(400).json({ error: '請先停用這個帳號，才能永久刪除' });
  }
  if (target.password_hash) {
    return res.status(400).json({ error: '這個帳號設定過密碼（曾經登入過），為了保留紀錄只能停用，不能永久刪除' });
  }

  for (const { table, label } of CASCADE_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('staff_id', target.id);
    if (error) {
      return res.status(400).json({ error: `無法確認這個帳號有沒有${label}，為了安全先不刪除，請維持停用` });
    }
    if (count > 0) {
      return res.status(400).json({ error: `這個帳號還有${label}，刪除會一起被清掉，請維持停用` });
    }
  }

  const { error } = await supabase.from('staff').delete().eq('id', target.id);
  if (error) {
    // 23503 = 還有其他資料表指向這個帳號（例如自評表、打卡紀錄），資料庫擋下來了
    const msg = error.code === '23503'
      ? '這個帳號已經有其他紀錄（例如自評表、打卡），不能永久刪除，請維持停用'
      : error.message;
    return res.status(400).json({ error: msg });
  }
  res.json({ ok: true, deleted: target.id });
});

export default router;
