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
//
// 信箱驗證碼（主管以上、而且有填 staff.verify_email 的帳號，判斷在 Levels.gs 的 requiresEmailVerify_）：
//   密碼對了之後不發憑證，改寄 6 位數驗證碼到那個信箱，填對才發憑證（憑證上記 mfa: true）。
//   沒有 mfa 標記的憑證不被接受，所以一填好 Email，他原本的登入狀態就失效，下次登入開始要驗證碼；
//   Email 清空就恢復只用密碼。收不到信時，試算表擁有者可以直接清空 staff 分頁的 verify_email。
// ============================================================

const TOKEN_DAYS = 90;
// 通過信箱驗證的憑證有效時間：每次登入都要驗證，所以不留太久；
// 不設更短是避免面談進行到一半被登出、沒存的內容遺失
const VERIFIED_TOKEN_HOURS = 12;

// 同一個登入代碼連錯幾次就暫時鎖定（時間到自動解除）
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;

const VERIFY_CODE_SECONDS = 10 * 60;  // 驗證碼有效時間
const VERIFY_MAX_TRIES = 5;           // 同一組驗證碼可以填錯幾次，超過就作廢
const VERIFY_RESEND_SECONDS = 60;     // 同一個帳號多久內不重複寄信

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

// opts.verified：通過信箱驗證（憑證記 mfa，有效時間較短）
// opts.switched：測試站「切換身分」簽發的（憑證記 mfa，不用再驗證信箱；見 TestIdentity.gs）
// opts.by：切換身分時，記下原本是誰切過來的
function issueToken_(staffId, opts) {
  opts = opts || {};
  const life = opts.verified ? VERIFIED_TOKEN_HOURS * 3600000 : TOKEN_DAYS * 86400000;
  const data = { sid: staffId, exp: Date.now() + life };
  if (opts.by) data.by = opts.by;
  if (opts.verified || opts.switched) data.mfa = true;
  const payload = base64Url_(JSON.stringify(data));
  return payload + '.' + sign_(payload);
}

// 驗證成功回傳憑證內容 { sid, exp, by?, mfa? }，失敗回傳 null
function readToken_(token) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) return null;
  try {
    let text = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4) text += '=';
    const data = JSON.parse(Utilities.newBlob(Utilities.base64Decode(text)).getDataAsString());
    if (!data.sid || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// 驗證成功回傳同仁 id，失敗回傳 null
function verifyToken_(token) {
  const data = readToken_(token);
  return data ? data.sid : null;
}

// ---------- 身分與帳號層級（層級規則見 Levels.gs） ----------

// 從憑證找出「目前登入的是誰」，找不到或已停用就丟 401
// level：帳號層級（field／manager／hq_admin／office）
// switched_by：測試站切換過來的身分才有，記著原本是誰切過來的
function authenticate_(token) {
  const data = readToken_(token);
  if (!data) throw httpError_(401, '登入已過期，請重新登入');
  const staff = Db.first('staff', { id: data.sid });
  if (!staff || staff.is_active !== true) throw httpError_(401, '帳號已停用或不存在，請重新登入');
  const role = roleById_(staff.role_id);
  const level = levelOf_(staff, role);
  if (!data.mfa && requiresEmailVerify_(staff, level)) throw httpError_(401, '請重新登入並完成信箱驗證');
  return Object.assign(staff, { roles: role, level: level, switched_by: data.by || null });
}

function requireLevel_(actor, levels, message) {
  if (levels.indexOf(actor.level) < 0) throw httpError_(403, message || '你沒有權限使用這個功能');
}

// 看全公司資料的層級（總公司行政、總辦公室）看全部；主管只能看自己部門
function requireBranchAccess_(actor, branchId) {
  if (canViewAllSelfEval_(actor.level)) return;
  if (actor.level === 'manager' && branchId === actor.branch_id) return;
  throw httpError_(403, '你沒有權限查看這個部門的資料');
}

// 登入、切換身分、/api/me 回傳給網頁存進 localStorage 的 staff 物件
function sessionStaff_(staff) {
  const role = roleById_(staff.role_id);
  return {
    id: staff.id,
    name: staff.name,
    branch_id: staff.branch_id,
    role_id: staff.role_id,
    is_active: staff.is_active,
    roles: role,
    account_level: levelOf_(staff, role),
  };
}

// GET /api/me：目前登入的人（網頁用來補上舊登入資料沒有的 account_level）
function apiMe_(req) {
  return sessionStaff_(req.actor);
}

// ---------- API：登入 ----------

// 輸入的代碼可能是任何內容，而且不管代碼存不存在都要計數（鎖定訊息才不會透露代碼是否存在），所以 key 一律用雜湊
function loginFailKey_(loginCode) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(loginCode), Utilities.Charset.UTF_8);
  return 'login_fail_' + base64Url_(digest);
}

function loginFailCount_(key) {
  return Number(CacheService.getScriptCache().get(key)) || 0;
}

// 記一次失敗，並回傳統一的錯誤：不透露是代碼錯、密碼錯還是帳號已停用
function loginFailed_(key) {
  CacheService.getScriptCache().put(key, String(loginFailCount_(key) + 1), LOGIN_LOCK_SECONDS);
  return httpError_(401, '登入代碼或密碼錯誤');
}

// POST /api/login  { login_code, password }
// 一頁式登入：登入代碼＋密碼一起送出
function apiLogin_(req) {
  const body = req.body || {};
  const loginCode = body.login_code;
  const password = body.password;
  if (!loginCode) throw httpError_(400, '缺少 login_code');
  if (!password) throw httpError_(400, '請輸入密碼');

  const failKey = loginFailKey_(loginCode);
  if (loginFailCount_(failKey) >= LOGIN_MAX_FAILS) throw httpError_(429, '嘗試次數過多，請 15 分鐘後再試');

  // Railway 版用 .single()：同一個登入代碼對到兩個人時也算登入失敗
  const matches = Db.where('staff', function (s) {
    return s.login_code === String(loginCode) && s.is_active === true;
  });
  if (matches.length !== 1) {
    // 找不到帳號也花一樣的時間算一次密碼，否則外人可以從回應快慢判斷代碼是否存在
    hashPassword_(password);
    throw loginFailed_(failKey);
  }
  const staff = matches[0];

  const hash = getPasswordHash_(staff.id);
  if (!hash) {
    // 第一次登入：這次輸入的密碼直接設成新密碼
    setPasswordHash_(staff.id, hashPassword_(password));
  } else if (!checkPassword_(password, hash)) {
    throw loginFailed_(failKey);
  }

  CacheService.getScriptCache().remove(failKey);
  if (requiresEmailVerify_(staff, levelOf_(staff))) return startEmailVerify_(staff);
  return Object.assign(sessionStaff_(staff), { token: issueToken_(staff.id) });
}

// ---------- API：信箱驗證碼 ----------

function verifyKey_(challenge) {
  return 'verify_' + challenge;
}

function verifySentKey_(staffId) {
  return 'verify_sent_' + staffId;
}

// a***@gmail.com：讓本人知道寄到哪裡，又不會把完整信箱顯示在畫面上
function maskEmail_(email) {
  const parts = email.split('@');
  return parts[0].charAt(0) + '***@' + parts[1];
}

// 用 getUuid 的亂數取 6 位數（Math.random 不夠隨機，不適合當驗證碼）
function newVerifyCode_() {
  const n = parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 1000000;
  return ('00000' + n).slice(-6);
}

function verifyCodeHash_(challenge, code) {
  return sign_(challenge + ':' + code);
}

// 密碼正確之後：寄驗證碼，回傳網頁第二步需要的資料（這時候還不發憑證）
function startEmailVerify_(staff) {
  const cache = CacheService.getScriptCache();
  const email = String(staff.verify_email).trim();
  const respond = function (challenge) {
    return { verify_required: true, challenge: challenge, email_hint: maskEmail_(email) };
  };

  // 剛寄過就不重寄：驗證碼還有效時直接回到輸入畫面；已經作廢的要等一下才能再寄
  const lastChallenge = cache.get(verifySentKey_(staff.id));
  if (lastChallenge) {
    if (cache.get(verifyKey_(lastChallenge))) return respond(lastChallenge);
    throw httpError_(429, '驗證碼剛寄出不久，請一分鐘後再試');
  }

  const challenge = Utilities.getUuid();
  const code = newVerifyCode_();
  try {
    MailApp.sendEmail({
      to: email,
      subject: '路得行旅 每日營運系統 登入驗證碼',
      name: '路得行旅 每日營運系統',
      body: staff.name + ' 你好：\n\n你的登入驗證碼是 ' + code + '，' + (VERIFY_CODE_SECONDS / 60) + ' 分鐘內有效。\n\n' +
        '如果不是你本人操作，代表有人知道你的密碼，請立刻改密碼並通知總辦公室。',
    });
  } catch (err) {
    console.error('[login] 驗證碼寄送失敗：' + err.message);
    throw httpError_(500, '驗證碼寄送失敗，請稍後再試；一直失敗請聯絡總辦公室');
  }

  cache.put(verifyKey_(challenge), JSON.stringify({
    sid: staff.id,
    hash: verifyCodeHash_(challenge, code),
    tries: 0,
    exp: Date.now() + VERIFY_CODE_SECONDS * 1000,
  }), VERIFY_CODE_SECONDS);
  cache.put(verifySentKey_(staff.id), challenge, VERIFY_RESEND_SECONDS);
  return respond(challenge);
}

// POST /api/login/verify  { challenge, code }
function apiLoginVerify_(req) {
  const body = req.body || {};
  const challenge = String(body.challenge || '');
  const code = String(body.code || '').trim();
  const cache = CacheService.getScriptCache();
  const expired = httpError_(401, '驗證碼已失效，請重新登入', { restart: true });

  const raw = /^[0-9a-f-]{36}$/i.test(challenge) ? cache.get(verifyKey_(challenge)) : null;
  if (!raw) throw expired;
  const entry = JSON.parse(raw);
  if (entry.exp < Date.now()) throw expired;

  if (verifyCodeHash_(challenge, code) !== entry.hash) {
    entry.tries++;
    if (entry.tries >= VERIFY_MAX_TRIES) {
      cache.remove(verifyKey_(challenge));
      throw httpError_(401, '驗證碼錯誤次數過多，請重新登入', { restart: true });
    }
    cache.put(verifyKey_(challenge), JSON.stringify(entry), Math.ceil((entry.exp - Date.now()) / 1000));
    throw httpError_(401, '驗證碼不正確，請再試一次');
  }

  // 驗證碼用過就失效；重新登入可以馬上寄新的
  cache.remove(verifyKey_(challenge));
  cache.remove(verifySentKey_(entry.sid));
  const staff = Db.first('staff', { id: entry.sid });
  if (!staff || staff.is_active !== true) throw expired;
  return Object.assign(sessionStaff_(staff), { token: issueToken_(staff.id, { verified: true }) });
}
