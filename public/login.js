const API = window.APP_CONFIG.API_BASE_URL;

const loginForm = document.getElementById('loginForm');
const loginCodeInput = document.getElementById('loginCode');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');
const loginIntro = document.getElementById('loginIntro');
const firstLoginHint = document.getElementById('firstLoginHint');
const verifyForm = document.getElementById('verifyForm');
const verifyHint = document.getElementById('verifyHint');
const verifyCodeInput = document.getElementById('verifyCode');
const verifyBtn = document.getElementById('verifyBtn');
const verifyBack = document.getElementById('verifyBack');

// 手機切去收信再切回來時，瀏覽器可能重新載入頁面；暫存起來才不會回到第一步
const PENDING_VERIFY_KEY = 'pendingVerify';
const PENDING_VERIFY_MS = 10 * 60 * 1000; // 跟後端驗證碼的有效時間一樣
let pendingVerify = null;

const savedStaff = localStorage.getItem('staff');
if (savedStaff) {
  routeByRole(JSON.parse(savedStaff));
} else {
  const pending = loadPendingVerify();
  if (pending) showVerifyStep(pending);
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  doLogin();
});

verifyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  doVerify();
});

verifyBack.addEventListener('click', () => backToLogin(''));

function loadPendingVerify() {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_VERIFY_KEY) || 'null');
    return pending && pending.exp > Date.now() ? pending : null;
  } catch (e) {
    return null;
  }
}

function savePendingVerify(pending) {
  try {
    if (pending) sessionStorage.setItem(PENDING_VERIFY_KEY, JSON.stringify(pending));
    else sessionStorage.removeItem(PENDING_VERIFY_KEY);
  } catch (e) { /* 存不了就算了，只是切回來時要重新登入 */ }
}

// 第二步：輸入信箱驗證碼（主管以上、有填 Email 的帳號才會走到這裡）
function showVerifyStep(pending) {
  pendingVerify = pending;
  savePendingVerify(pending);
  errorMsg.textContent = '';
  verifyHint.textContent = `驗證碼已寄到 ${pending.email_hint}，10 分鐘內有效。沒收到的話，請看一下垃圾郵件。`;
  verifyCodeInput.value = '';
  loginIntro.style.display = 'none';
  firstLoginHint.style.display = 'none';
  loginForm.style.display = 'none';
  verifyForm.style.display = '';
  verifyCodeInput.focus();
}

function backToLogin(message) {
  pendingVerify = null;
  savePendingVerify(null);
  errorMsg.textContent = message;
  loginIntro.style.display = '';
  firstLoginHint.style.display = '';
  verifyForm.style.display = 'none';
  loginForm.style.display = '';
  passwordInput.focus();
}

async function doLogin() {
  errorMsg.textContent = '';
  const code = loginCodeInput.value.trim();
  const password = passwordInput.value;
  if (!code) { errorMsg.textContent = '請輸入登入代碼'; return; }
  if (!password) { errorMsg.textContent = '請輸入密碼'; return; }

  loginBtn.textContent = '登入中…';
  loginBtn.disabled = true;

  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_code: code, password }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '登入失敗');
    const data = await res.json();

    if (data.verify_required) {
      passwordInput.value = '';
      loginBtn.textContent = '登入';
      loginBtn.disabled = false;
      showVerifyStep({ challenge: data.challenge, email_hint: data.email_hint, exp: Date.now() + PENDING_VERIFY_MS });
      return;
    }
    await finishLogin(data);
  } catch (err) {
    errorMsg.textContent = err.message;
    loginBtn.textContent = '登入';
    loginBtn.disabled = false;
  }
}

async function doVerify() {
  errorMsg.textContent = '';
  const code = verifyCodeInput.value.trim();
  if (!code) { errorMsg.textContent = '請輸入驗證碼'; return; }

  verifyBtn.textContent = '驗證中…';
  verifyBtn.disabled = true;

  try {
    const res = await fetch(`${API}/api/login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge: pendingVerify.challenge, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      // 驗證碼已經作廢或過期：回第一步重新輸入密碼
      if (data.restart) { backToLogin(data.error); } else { errorMsg.textContent = data.error || '驗證失敗'; }
      verifyBtn.textContent = '確認';
      verifyBtn.disabled = false;
      return;
    }
    savePendingVerify(null);
    await finishLogin(data);
  } catch (err) {
    errorMsg.textContent = err.message;
    verifyBtn.textContent = '確認';
    verifyBtn.disabled = false;
  }
}

// 拿到登入憑證之後：查今天的班別、存登入狀態、導到首頁（密碼登入和驗證碼登入共用）
async function finishLogin(staff) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const schedRes = await fetch(`${API}/api/schedule/today?staff_id=${staff.id}&date=${today}`);
    const sched = await schedRes.json();
    staff.todayShiftCode = sched?.shift_code || null;
  } catch (e) {
    staff.todayShiftCode = null;
  }

  localStorage.setItem('staff', JSON.stringify(staff));
  routeByRole(staff);
}

// 依角色決定要去哪一頁；如果那一頁的功能被總公司關掉了，就改導到自評表
async function routeByRole(staff) {
  const target = landingPageFor(staff);
  if (!target) return; // 沒有對應頁面的角色，landingPageFor 已經跳過提示

  let disabledPages = [];
  try {
    const res = await fetch(`${API}/api/features`);
    const data = await res.json();
    disabledPages = data?.disabled_pages || [];
  } catch (e) { /* 查不到就照原本的導頁走 */ }

  window.location.href = disabledPages.includes(target) ? 'self-eval.html' : target;
}

// 登入後的首頁看帳號層級（gas/Levels.gs）
// 現場人員、人事行政：「我的總覽」（自己還有哪些事要做）。
// 以前現場人員依職務、當日班別直接進房務打卡／客務班別任務頁，那些功能重新開放時，可以從總覽的待辦連過去
function landingPageFor(staff) {
  const level = window.accountLevelOf(staff);
  if (level === 'office') return 'hq-dashboard.html';
  if (level === 'manager') return 'manager-home.html';
  return 'staff-home.html';
}
