const API = window.APP_CONFIG.API_BASE_URL;

const loginForm = document.getElementById('loginForm');
const loginCodeInput = document.getElementById('loginCode');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');

// 已登入就直接跳轉，不用重新輸入
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

    // 查今天實際排班（如果有），優先於固定職務決定要去哪一頁
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

function routeByRole(staff) {
  const code = staff.todayShiftCode;
  const roleName = staff.roles?.name || '';

  if (roleName === '總公司') { window.location.href = 'hq-home.html'; return; }
  if (roleName === '店經理') { window.location.href = 'manager-home.html'; return; }
  if (roleName.includes('房務')) { window.location.href = 'housekeeping-home.html'; return; }

  if (roleName === '客務人員') {
    // 客務跟著排班表走，沒排班就不能猜今天是哪一班
    if (code === 'A' || code === 'B' || code === 'C') { window.location.href = 'frontdesk-home.html'; return; }
    if (code === '1') { window.location.href = 'offday.html'; return; }
    window.location.href = 'unscheduled.html';
    return;
  }

  alert(`目前尚未有對應「${roleName}」的頁面，之後會陸續加上。`);
}
