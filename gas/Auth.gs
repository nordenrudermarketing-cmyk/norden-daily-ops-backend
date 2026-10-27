// ============================================================
// 登入、密碼、登入憑證
//
// 密碼：
//   只存 bcrypt 雜湊（跟 Railway 版相同格式，舊密碼可以直接沿用），
//   放在「指令碼屬性」PW_<同仁 id>，只有系統擁有者看得到，試算表裡沒有密碼欄位。
//   沒有雜湊＝還沒設定過密碼：第一次登入時輸入的密碼就會變成他的密碼（跟原本一樣）。
//
// 登入憑證（token）：
//   登入成功後由伺服器發一張有簽章的憑證，存在瀏覽器的 staff 物件裡，之後每次呼叫都會帶著。
//   後端只相信憑證上的身分，不再相信網頁送來的 actor_id——
//   這修掉了 Railway 版「知道 API 就能冒用別人身分」的漏洞。
//   簽章用的密鑰 TOKEN_SECRET 也在指令碼屬性，第一次使用時自動產生。
//   改掉 TOKEN_SECRET（或刪掉讓它重新產生）＝所有人都要重新登入。
// ============================================================

const TOKEN_DAYS = 90;

function bcrypt_() {
  const lib = globalThis.dcodeIO.bcrypt;
  // Apps Script 沒有瀏覽器的亂數產生器，產生 salt 用 Math.random 代替
  lib.setRandomFallback(function (len) {
    const bytes = [];
    for (let i = 0; i < len; i++) bytes.push(Math.floor(Math.random() * 256));
    return bytes;
  });
  return lib;
}

function props_() {
  return PropertiesService.getScriptProperties();
}

// ---------- 密碼 ----------

function getPasswordHash_(staffId) {
  return props_().getProperty('PW_' + staffId);
}

function setPasswordHash_(staffId, hash) {
  if (hash) props_().setProperty('PW_' + staffId, hash);
  else props_().deleteProperty('PW_' + staffId);
}

function hashPassword_(password) {
  return bcrypt_().hashSync(password, 10);
}

function checkPassword_(password, hash) {
  return bcrypt_().compareSync(password, hash);
}

// 一次讀出所有人「有沒有設定密碼」（帳號管理列表用，避免每個人讀一次）
function passwordFlags_() {
  const all = props_().getProperties();
  const flags = {};
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('PW_') === 0 && all[k]) flags[k.slice(3)] = true;
  });
  return flags;
}

// ---------- 登入憑證 ----------

function tokenSecret_() {
  let secret = props_().getProperty('TOKEN_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props_().setProperty('TOKEN_SECRET', secret);
  }
  return secret;
}

function base64Url_(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/, '');
}

function sign_(payload) {
  return base64Url_(Utilities.computeHmacSha256Signature(payload, tokenSecret_()));
}

function issueToken_(staffId) {
  const payload = base64Url_(JSON.stringify({ sid: staffId, exp: Date.now() + TOKEN_DAYS * 86400000 }));
  return payload + '.' + sign_(payload);
}

// 驗證成功回傳同仁 id，失敗回傳 null
function verifyToken_(token) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) return null;
  try {
    let text = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4) text += '=';
    const data = JSON.parse(Utilities.newBlob(Utilities.base64Decode(text)).getDataAsString());
    if (!data.sid || !data.exp || data.exp < Date.now()) return null;
    return data.sid;
  } catch (e) {
    return null;
  }
}

// ---------- 身分與職級 ----------

function levelOf_(roleName) {
  if (roleName === '總公司') return 'hq';
  if (roleName === '店經理') return 'manager';
  return 'none';
}

// 從憑證找出「目前登入的是誰」，找不到或已停用就丟 401
function authenticate_(token) {
  const sid = verifyToken_(token);
  if (!sid) throw httpError_(401, '登入已過期，請重新登入');
  const staff = Db.first('staff', { id: sid });
  if (!staff || staff.is_active !== true) throw httpError_(401, '帳號已停用或不存在，請重新登入');
  const role = roleById_(staff.role_id);
  return Object.assign(staff, { roles: role, level: levelOf_(role && role.name) });
}

function requireLevel_(actor, levels, message) {
  if (levels.indexOf(actor.level) < 0) throw httpError_(403, message || '你沒有權限使用這個功能');
}

// 主管只能看自己館別的資料，總公司看全部
function requireBranchAccess_(actor, branchId) {
  if (actor.level === 'hq') return;
  if (actor.level === 'manager' && branchId === actor.branch_id) return;
  throw httpError_(403, '你沒有權限查看這個館別的資料');
}

// ---------- API：登入 ----------

// POST /api/login  { login_code, password }
// 一頁式登入：登入代碼＋密碼一起送出
function apiLogin_(req) {
  const body = req.body || {};
  const loginCode = body.login_code;
  const password = body.password;
  if (!loginCode) throw httpError_(400, '缺少 login_code');
  if (!password) throw httpError_(400, '請輸入密碼');

  // Railway 版用 .single()：同一個登入代碼對到兩個人時也算登入失敗
  const matches = Db.where('staff', function (s) {
    return s.login_code === String(loginCode) && s.is_active === true;
  });
  if (matches.length !== 1) throw httpError_(401, '登入代碼錯誤或帳號已停用');
  const staff = matches[0];

  const hash = getPasswordHash_(staff.id);
  if (!hash) {
    // 第一次登入：這次輸入的密碼直接設成新密碼
    setPasswordHash_(staff.id, hashPassword_(password));
  } else if (!checkPassword_(password, hash)) {
    throw httpError_(401, '密碼錯誤');
  }

  return {
    id: staff.id,
    name: staff.name,
    branch_id: staff.branch_id,
    role_id: staff.role_id,
    is_active: staff.is_active,
    roles: roleById_(staff.role_id),
    token: issueToken_(staff.id),
  };
}
