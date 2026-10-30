// ============================================================
// 組織設定：部門、職務、自評題目類別（2026-10 起）
//
//   部門（branches 表，畫面上叫「部門」）：隸屬哪裡，例如台中館、台東1館、行銷、咖啡廳。
//     只用來分組、統計，不決定權限。只有總辦公室能新增、改名、停用；有人在的部門不能停用；不能刪除。
//   職務（roles 表）：工作內容，只決定自評表除了共同題目以外，還要加哪一類專屬題目（template_category）。
//     跟權限完全無關（權限看帳號層級，見 Levels.gs）。只有總辦公室能管理。
//   題目類別：QUESTION_CATEGORIES 是唯一的定義。之後要新增類別（例如咖啡廳專屬題目），
//     在這裡加一筆，自評題目管理、職務管理、自評表的標題都會自動跟上。
// ============================================================

// key 會存在 self_eval_templates.category 和 roles.template_category
//   label：題目管理、自評表上的區塊名稱
//   roleLabel：職務管理選題目類別時的說明
const QUESTION_CATEGORIES = [
  { key: 'common', label: '全部門共同自檢項目', short: '全部門共同', roleLabel: '只有共同題目' },
  { key: 'management', label: '經理職專屬自檢項目', short: '經理職專屬', roleLabel: '共同題目＋經理職專屬' },
  { key: 'housekeeping', label: '房務部門專屬自檢項目', short: '房務部門專屬', roleLabel: '共同題目＋房務部門專屬' },
  { key: 'frontdesk', label: '客務部門專屬自檢項目', short: '客務部門專屬', roleLabel: '共同題目＋客務部門專屬' },
];

function questionCategoryLabels_() {
  const map = {};
  QUESTION_CATEGORIES.forEach(function (c) { map[c.key] = c.label; });
  return map;
}

function isQuestionCategory_(key) {
  return QUESTION_CATEGORIES.some(function (c) { return c.key === key; });
}

// 這個職務的專屬題目類別（'common'＝只有共同題目）。
// 還沒做過「帳號層級轉換」的舊職務沒有 template_category，就用舊的 category 推算
function questionCategoryOf_(role) {
  if (!role) return 'common';
  if (role.template_category && isQuestionCategory_(role.template_category)) return role.template_category;
  const legacy = { housekeeping: 'housekeeping', frontdesk: 'frontdesk', management: 'management', headquarters: 'management' };
  return legacy[role.category] || 'common';
}

// GET /api/self-eval/categories：題目類別清單（題目管理頁用）
function apiQuestionCategories_() {
  return QUESTION_CATEGORIES;
}

// ---------- 部門（限總辦公室） ----------

function countBy_(list, key) {
  const map = {};
  list.forEach(function (x) { map[x[key]] = (map[x[key]] || 0) + 1; });
  return map;
}

// GET /api/org/departments：所有部門（含停用的）與在職人數
function apiOrgDepartments_(req) {
  requireOffice_(req.actor, '部門管理只有總辦公室可以使用');
  const counts = countBy_(Db.where('staff', { is_active: true }), 'branch_id');
  return Db.all('branches').sort(byName_).map(function (b) {
    return { id: b.id, name: b.name, code: b.code, is_active: b.is_active !== false, staff_count: counts[b.id] || 0 };
  });
}

function departmentNameTaken_(name, exceptId) {
  return Db.all('branches').some(function (b) { return b.name === name && b.id !== exceptId; });
}

// POST /api/org/departments  { name, code? }
function apiOrgDepartmentCreate_(req) {
  requireOffice_(req.actor, '部門管理只有總辦公室可以使用');
  const name = cleanText_(req.body.name);
  if (!name) throw httpError_(400, '請填寫部門名稱');
  if (departmentNameTaken_(name)) throw httpError_(400, '已經有叫「' + name + '」的部門');
  return Db.insert('branches', { name: name, code: cleanText_(req.body.code) || null, is_active: true })[0];
}

// PUT /api/org/departments/:id  { name?, code?, is_active? }
function apiOrgDepartmentUpdate_(req) {
  requireOffice_(req.actor, '部門管理只有總辦公室可以使用');
  const dept = Db.first('branches', { id: req.params.id });
  if (!dept) throw httpError_(404, '找不到這個部門');
  const patch = {};
  if (req.body.name !== undefined) {
    const name = cleanText_(req.body.name);
    if (!name) throw httpError_(400, '請填寫部門名稱');
    if (departmentNameTaken_(name, dept.id)) throw httpError_(400, '已經有叫「' + name + '」的部門');
    patch.name = name;
  }
  if (req.body.code !== undefined) patch.code = cleanText_(req.body.code) || null;
  if (req.body.is_active !== undefined) {
    if (req.body.is_active === false && Db.where('staff', { branch_id: dept.id, is_active: true }).length > 0) {
      throw httpError_(400, '這個部門還有在職的同仁，請先把他們調到其他部門，才能停用');
    }
    patch.is_active = !!req.body.is_active;
  }
  return Db.update('branches', { id: dept.id }, patch)[0];
}

// ---------- 職務（限總辦公室） ----------

// GET /api/org/roles：所有職務（含停用的）、在職人數、題目類別選項
function apiOrgRoles_(req) {
  requireOffice_(req.actor, '職務管理只有總辦公室可以使用');
  const counts = countBy_(Db.where('staff', { is_active: true }), 'role_id');
  return {
    categories: QUESTION_CATEGORIES,
    roles: Db.all('roles').sort(byName_).map(function (r) {
      return {
        id: r.id, name: r.name, template_category: questionCategoryOf_(r),
        is_active: r.is_active !== false, staff_count: counts[r.id] || 0,
      };
    }),
  };
}

function roleNameTaken_(name, exceptId) {
  return Db.all('roles').some(function (r) { return r.name === name && r.id !== exceptId; });
}

// POST /api/org/roles  { name, template_category }
function apiOrgRoleCreate_(req) {
  requireOffice_(req.actor, '職務管理只有總辦公室可以使用');
  const name = cleanText_(req.body.name);
  const category = req.body.template_category || 'common';
  if (!name) throw httpError_(400, '請填寫職務名稱');
  if (!isQuestionCategory_(category)) throw httpError_(400, '請選擇題目類別');
  if (roleNameTaken_(name)) throw httpError_(400, '已經有叫「' + name + '」的職務');
  // category 是舊系統的欄位，填一樣的值讓舊程式也看得懂
  return Db.insert('roles', { name: name, category: category, template_category: category, is_active: true })[0];
}

// PUT /api/org/roles/:id  { name?, template_category?, is_active? }
function apiOrgRoleUpdate_(req) {
  requireOffice_(req.actor, '職務管理只有總辦公室可以使用');
  const role = Db.first('roles', { id: req.params.id });
  if (!role) throw httpError_(404, '找不到這個職務');
  const patch = {};
  if (req.body.name !== undefined) {
    const name = cleanText_(req.body.name);
    if (!name) throw httpError_(400, '請填寫職務名稱');
    if (roleNameTaken_(name, role.id)) throw httpError_(400, '已經有叫「' + name + '」的職務');
    patch.name = name;
  }
  if (req.body.template_category !== undefined) {
    if (!isQuestionCategory_(req.body.template_category)) throw httpError_(400, '請選擇題目類別');
    patch.template_category = req.body.template_category;
  }
  if (req.body.is_active !== undefined) {
    if (req.body.is_active === false && Db.where('staff', { role_id: role.id, is_active: true }).length > 0) {
      throw httpError_(400, '還有在職的同仁是這個職務，請先改成其他職務，才能停用');
    }
    patch.is_active = !!req.body.is_active;
  }
  return Db.update('roles', { id: role.id }, patch)[0];
}

// ---------- 一次性轉換（試算表選單，見 Setup.gs） ----------

// 帳號層級轉換：把「職務兼權限」的舊資料，拆成「職務」「帳號層級」
//   職務改名：店經理 → 經理、總公司 → 總辦公室經理；每個職務補上題目類別、啟用狀態
//   帳號層級：只填還空白的人——總辦公室經理 → 總辦公室、經理 → 經理、其他 → 現場人員
//   部門：補上啟用狀態
// 可以重複執行，已經填好的不會被改掉
function migrateAccountLevels_() {
  const renames = { '店經理': '經理', '總公司': '總辦公室經理' };
  const report = [];
  return Db.transaction(function () {
    const rolePatches = {};
    Db.all('roles').forEach(function (r) {
      const patch = {};
      if (renames[r.name] && !roleNameTaken_(renames[r.name], r.id)) {
        patch.name = renames[r.name];
        report.push('職務改名：' + r.name + ' → ' + renames[r.name]);
      }
      if (!r.template_category) patch.template_category = questionCategoryOf_(r);
      if (r.is_active === null || r.is_active === undefined) patch.is_active = true;
      if (Object.keys(patch).length) rolePatches[r.id] = patch;
    });
    Db.updateById('roles', rolePatches);

    const branchPatches = {};
    Db.all('branches').forEach(function (b) {
      if (b.is_active === null || b.is_active === undefined) branchPatches[b.id] = { is_active: true };
    });
    Db.updateById('branches', branchPatches);

    const counts = {};
    const staffPatches = {};
    Db.all('staff').forEach(function (s) {
      const level = levelOf_(s); // 空白的人依職務名稱推算（新舊名稱都認得）
      if (!s.account_level) staffPatches[s.id] = { account_level: level };
      if (s.is_active === true) counts[level] = (counts[level] || 0) + 1;
    });
    Db.updateById('staff', staffPatches);

    report.push('補上帳號層級：' + Object.keys(staffPatches).length + ' 人');
    report.push('在職人數：' + LEVEL_KEYS.map(function (k) { return levelLabel_(k) + ' ' + (counts[k] || 0); }).join('、'));
    return report;
  });
}

// 新增總辦公室帳號（後門：系統裡所有總辦公室帳號都不能用時，由試算表擁有者建立）
function createOfficeAccount_(name, loginCode) {
  name = cleanText_(name);
  loginCode = cleanText_(loginCode);
  if (!name || !loginCode) throw new Error('請填寫姓名和登入代碼');
  if (loginCodeTaken_(loginCode)) throw new Error('登入代碼「' + loginCode + '」已經有人使用，可以改用「把帳號設為總辦公室」');
  const role = Db.first('roles', { name: '總辦公室經理' }) || Db.all('roles')[0];
  const branch = Db.first('branches', { code: 'HQ' }) || Db.all('branches')[0];
  return Db.insert('staff', {
    name: name, login_code: loginCode, branch_id: branch ? branch.id : null, role_id: role ? role.id : null,
    account_level: 'office', is_active: true, is_part_time: false, learning_map_enabled: false,
  })[0];
}

// 把現有帳號設為總辦公室並重新啟用
function promoteToOffice_(loginCode) {
  loginCode = cleanText_(loginCode);
  const staff = Db.first('staff', { login_code: loginCode });
  if (!staff) throw new Error('找不到登入代碼「' + loginCode + '」的帳號');
  return Db.update('staff', { id: staff.id }, { account_level: 'office', is_active: true })[0];
}
