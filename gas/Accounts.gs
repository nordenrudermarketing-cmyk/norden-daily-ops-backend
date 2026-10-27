// ============================================================
// 帳號管理（總公司、店經理用）——規則與 Railway 版 routes/accounts.js 相同
//
// 差別：「目前登入的是誰」改由登入憑證決定（Auth.gs），網頁送來的 actor_id 一律忽略，
//       所以沒辦法再偽造身分。
//
// 權限規則：
//   總公司：所有館別、所有職務的帳號都能管理
//   店經理：只能管理「自己館別」的「房務、客務」帳號；自己的帳號只能改密碼
//   其他人：不能使用
//
// 刪除：一律先「停用」（不能登入，但所有紀錄保留，之後可以再啟用）。
//   只有「已停用」而且「從來沒設定過密碼」的帳號才能永久刪除（通常是建錯的帳號）。
// ============================================================

// 店經理可以管理的職務類別
const GENERAL_CATEGORIES = ['housekeeping', 'frontdesk'];

// 永久刪除前要確認這些表裡沒有這個人的紀錄
// （其他功能的舊資料還在 Supabase 備份裡；那些功能搬過來時要把表加進這裡）
const STAFF_RECORD_TABLES = [
  { table: 'staff_schedule', column: 'staff_id', label: '排班紀錄' },
  { table: 'daily_team_leads', column: 'staff_id', label: '小隊長排班' },
  { table: 'self_eval_submissions', column: 'staff_id', label: '自評表' },
];

function cleanText_(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function accountActor_(req) {
  const actor = req.actor;
  if (actor.level === 'none') throw httpError_(403, '帳號管理只有總公司和店經理可以使用');
  return actor;
}

function withRelations_(s) {
  return Object.assign(s, { roles: roleById_(s.role_id), branches: branchById_(s.branch_id) });
}

function canManage_(actor, target) {
  if (actor.level === 'hq') return true;
  return actor.level === 'manager' &&
    target.branch_id === actor.branch_id &&
    GENERAL_CATEGORIES.indexOf(target.roles && target.roles.category) >= 0;
}

// 回傳給網頁的樣子：不含密碼，並附上「這個主管對這個帳號能做什麼」
function toPublicAccount_(actor, s, hasPassword) {
  const manageable = canManage_(actor, s);
  const isSelf = s.id === actor.id;
  const isActive = s.is_active !== false;
  return {
    id: s.id,
    name: s.name,
    login_code: s.login_code,
    branch_id: s.branch_id,
    branch_name: s.branches ? s.branches.name : null,
    role_id: s.role_id,
    role_name: s.roles ? s.roles.name : null,
    role_category: s.roles ? s.roles.category : null,
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

function loadTarget_(id) {
  const s = Db.first('staff', { id: id });
  if (!s) throw httpError_(404, '找不到這個帳號');
  return withRelations_(s);
}

function accountResponse_(actor, id) {
  const fresh = Db.first('staff', { id: id });
  if (!fresh) return { ok: true };
  return toPublicAccount_(actor, withRelations_(fresh), !!getPasswordHash_(id));
}

// 登入時用登入代碼找人，重複的話兩個人都登入不了，所以一律不准重複（含已停用的）
function loginCodeTaken_(code, exceptId) {
  return Db.where('staff', { login_code: code }).some(function (s) { return s.id !== exceptId; });
}

// 決定新增／修改時實際要寫入的館別與職務（店經理的館別一律強制為自己的館別）
function resolveScope_(actor, branchId, roleId) {
  const role = roleId ? Db.first('roles', { id: roleId }) : null;
  if (!role) throw httpError_(400, '請選擇職務');

  if (actor.level === 'manager') {
    if (GENERAL_CATEGORIES.indexOf(role.category) < 0) throw httpError_(400, '店經理只能設定房務或客務職務的帳號');
    return { branch_id: actor.branch_id, role: role };
  }
  const branch = branchId ? Db.first('branches', { id: branchId }) : null;
  if (!branch) throw httpError_(400, '請選擇館別');
  return { branch_id: branch.id, role: role };
}

// 避免把最後一個啟用中的總公司帳號停用或改掉職務，否則就沒有人能再進後台了
function isLastActiveHQ_(target) {
  if (!target.roles || target.roles.name !== '總公司' || target.is_active === false) return false;
  return !Db.where('staff', { is_active: true }).some(function (s) {
    const role = roleById_(s.role_id);
    return s.id !== target.id && role && role.name === '總公司';
  });
}

// ---------- API ----------

// GET /api/accounts/meta：這個主管可以選的館別、職務（新增／編輯表單的下拉選單用）
function apiAccountsMeta_(req) {
  const actor = accountActor_(req);
  const isHQ = actor.level === 'hq';
  const branches = Db.all('branches').sort(byName_).map(function (b) { return { id: b.id, name: b.name, code: b.code }; });
  const roles = Db.all('roles').sort(byName_).map(function (r) { return { id: r.id, name: r.name, category: r.category }; });
  return {
    actor: { id: actor.id, name: actor.name, level: actor.level, branch_id: actor.branch_id },
    branches: isHQ ? branches : branches.filter(function (b) { return b.id === actor.branch_id; }),
    roles: isHQ ? roles : roles.filter(function (r) { return GENERAL_CATEGORIES.indexOf(r.category) >= 0; }),
  };
}

// GET /api/accounts：這個主管能管理的帳號（含已停用的），自己的帳號也會列出來方便改密碼
function apiAccountsList_(req) {
  const actor = accountActor_(req);
  const flags = passwordFlags_();
  return Db.where('staff', function (s) { return actor.level !== 'manager' || s.branch_id === actor.branch_id; })
    .map(withRelations_)
    .sort(byName_)
    .filter(function (s) { return canManage_(actor, s) || s.id === actor.id; })
    .map(function (s) { return toPublicAccount_(actor, s, !!flags[s.id]); });
}

// POST /api/accounts  { name, login_code, branch_id, role_id, is_part_time, password? }
function apiAccountsCreate_(req) {
  const actor = accountActor_(req);
  const name = cleanText_(req.body.name);
  const loginCode = cleanText_(req.body.login_code);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!name) throw httpError_(400, '請填寫姓名');
  if (!loginCode) throw httpError_(400, '請填寫登入代碼');
  const scope = resolveScope_(actor, req.body.branch_id, req.body.role_id);
  if (loginCodeTaken_(loginCode)) throw httpError_(400, '登入代碼「' + loginCode + '」已經有人使用');

  const created = Db.insert('staff', {
    name: name,
    login_code: loginCode,
    branch_id: scope.branch_id,
    role_id: scope.role.id,
    is_active: true,
    is_part_time: !!req.body.is_part_time,
    learning_map_enabled: false,
  })[0];
  // 沒給密碼就留空：同仁第一次登入時輸入的密碼會直接變成他的密碼
  if (password.trim()) setPasswordHash_(created.id, hashPassword_(password));
  return accountResponse_(actor, created.id);
}

// PUT /api/accounts/:id  { name, login_code, branch_id, role_id, is_part_time }
function apiAccountsUpdate_(req) {
  const actor = accountActor_(req);
  const target = loadTarget_(req.params.id);
  if (!canManage_(actor, target)) throw httpError_(403, '你沒有權限修改這個帳號');

  const name = cleanText_(req.body.name);
  const loginCode = cleanText_(req.body.login_code);
  if (!name) throw httpError_(400, '請填寫姓名');
  if (!loginCode) throw httpError_(400, '請填寫登入代碼');

  const scope = resolveScope_(actor, req.body.branch_id, req.body.role_id);
  if (target.id === actor.id && scope.role.id !== target.role_id) {
    throw httpError_(400, '不能修改自己的職務，避免把自己鎖在後台外面');
  }
  if (scope.role.name !== '總公司' && isLastActiveHQ_(target)) {
    throw httpError_(400, '這是最後一個啟用中的總公司帳號，不能改成其他職務');
  }
  if (loginCodeTaken_(loginCode, target.id)) throw httpError_(400, '登入代碼「' + loginCode + '」已經有人使用');

  Db.update('staff', { id: target.id }, {
    name: name,
    login_code: loginCode,
    branch_id: scope.branch_id,
    role_id: scope.role.id,
    is_part_time: !!req.body.is_part_time,
  });
  return accountResponse_(actor, target.id);
}

// POST /api/accounts/:id/password  { password }：主管幫同仁設定新密碼，或修改自己的密碼
function apiAccountsPassword_(req) {
  const actor = accountActor_(req);
  const target = loadTarget_(req.params.id);
  if (!canManage_(actor, target) && target.id !== actor.id) throw httpError_(403, '你沒有權限修改這個帳號的密碼');

  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!password.trim()) throw httpError_(400, '請輸入新密碼');
  setPasswordHash_(target.id, hashPassword_(password));
  return accountResponse_(actor, target.id);
}

// POST /api/accounts/:id/reset-password：清空密碼，對方下次登入時輸入的密碼會直接變成新密碼
function apiAccountsResetPassword_(req) {
  const actor = accountActor_(req);
  const target = loadTarget_(req.params.id);
  if (!canManage_(actor, target)) throw httpError_(403, '你沒有權限清空這個帳號的密碼');
  setPasswordHash_(target.id, null);
  return accountResponse_(actor, target.id);
}

// POST /api/accounts/:id/deactivate
function apiAccountsDeactivate_(req) {
  const actor = accountActor_(req);
  const target = loadTarget_(req.params.id);
  if (!canManage_(actor, target)) throw httpError_(403, '你沒有權限停用這個帳號');
  if (target.id === actor.id) throw httpError_(400, '不能停用自己的帳號');
  if (isLastActiveHQ_(target)) throw httpError_(400, '這是最後一個啟用中的總公司帳號，不能停用');
  Db.update('staff', { id: target.id }, { is_active: false });
  return accountResponse_(actor, target.id);
}

// POST /api/accounts/:id/activate
function apiAccountsActivate_(req) {
  const actor = accountActor_(req);
  const target = loadTarget_(req.params.id);
  if (!canManage_(actor, target)) throw httpError_(403, '你沒有權限啟用這個帳號');
  Db.update('staff', { id: target.id }, { is_active: true });
  return accountResponse_(actor, target.id);
}

// DELETE /api/accounts/:id：永久刪除，只限「已停用」且「從來沒設定過密碼」、而且沒有任何紀錄的帳號
function apiAccountsDelete_(req) {
  const actor = accountActor_(req);
  const target = loadTarget_(req.params.id);
  if (!canManage_(actor, target)) throw httpError_(403, '你沒有權限刪除這個帳號');
  if (target.id === actor.id) throw httpError_(400, '不能刪除自己的帳號');
  if (target.is_active !== false) throw httpError_(400, '請先停用這個帳號，才能永久刪除');
  if (getPasswordHash_(target.id)) {
    throw httpError_(400, '這個帳號設定過密碼（曾經登入過），為了保留紀錄只能停用，不能永久刪除');
  }
  STAFF_RECORD_TABLES.forEach(function (t) {
    const filter = {};
    filter[t.column] = target.id;
    if (Db.first(t.table, filter)) throw httpError_(400, '這個帳號還有' + t.label + '，不能永久刪除，請維持停用');
  });

  Db.remove('staff', { id: target.id });
  return { ok: true, deleted: target.id };
}
