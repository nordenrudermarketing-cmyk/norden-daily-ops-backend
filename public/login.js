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

  // 優先依今天實際排班的班別導向
  if (code === 'A' || code === 'B' || code === 'C') { window.location.href = 'shift.html'; return; }
  if (code === '房') { window.location.href = 'checklist.html'; return; }
  if (code === '1') { window.location.href = 'offday.html'; return; }

  const roleName = staff.roles?.name || '';

  // 店經理、總公司不是靠排班表運作的角色，維持照固定職務導向
  if (roleName === '總公司') {
    window.location.href = 'hq-dashboard.html';
    return;
  }
  if (roleName === '店經理') {
    window.location.href = 'dashboard.html';
    return;
  }

  // 房務的房號是小隊長另外分配的，跟排班表是兩件事，沒有排班紀錄也照樣能用打卡頁
  if (roleName.includes('房務')) {
    window.location.href = 'checklist.html';
    return;
  }

  // 客務（不分A/B/C，統一是「客務人員」職務）的任務內容跟著排班表走，
  // 沒有排班紀錄就不能猜今天是哪一班，導向提醒頁
  if (roleName === '客務人員') {
    window.location.href = 'unscheduled.html';
    return;
  }

  if (code) {
    alert(`今天班別代碼「${code}」尚未有對應頁面，之後會陸續加上。`);
  } else {
    alert(`目前尚未有對應「${roleName}」的頁面，之後會陸續加上。`);
  }
}
