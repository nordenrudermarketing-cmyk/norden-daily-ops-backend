const API = window.APP_CONFIG.API_BASE_URL;

const loginForm = document.getElementById('loginForm');
const loginCodeInput = document.getElementById('loginCode');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');

const savedStaff = localStorage.getItem('staff');
if (savedStaff) routeByRole(JSON.parse(savedStaff));

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  doLogin();
});

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
    const staff = await res.json();

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
  } catch (err) {
    errorMsg.textContent = err.message;
    loginBtn.textContent = '登入';
    loginBtn.disabled = false;
  }
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

function landingPageFor(staff) {
  const code = staff.todayShiftCode;
  const roleName = staff.roles?.name || '';

  if (roleName === '總公司') return 'hq-dashboard.html';
  if (roleName === '店經理') return 'dashboard.html';
  if (roleName.includes('房務')) return 'checklist.html';

  if (roleName === '客務人員') {
    if (code === 'A' || code === 'B' || code === 'C') return 'shift.html';
    if (code === '1') return 'offday.html';
    return 'unscheduled.html';
  }

  alert(`目前尚未有對應「${roleName}」的頁面，之後會陸續加上。`);
  return null;
}
