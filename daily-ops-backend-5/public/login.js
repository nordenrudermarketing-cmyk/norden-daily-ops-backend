const API = window.APP_CONFIG.API_BASE_URL;

const loginBtn = document.getElementById('loginBtn');
const loginCode = document.getElementById('loginCode');
const errorMsg = document.getElementById('errorMsg');

// 已登入就直接跳轉，不用重新輸入
const savedStaff = localStorage.getItem('staff');
if (savedStaff) routeByRole(JSON.parse(savedStaff));

loginBtn.addEventListener('click', doLogin);
loginCode.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  errorMsg.textContent = '';
  const code = loginCode.value.trim();
  if (!code) { errorMsg.textContent = '請輸入登入代碼'; return; }

  loginBtn.textContent = '登入中…';
  loginBtn.disabled = true;

  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_code: code }),
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
  if (code === 'A' || code === 'B') { window.location.href = 'shift.html'; return; }
  if (code === 'C') { window.location.href = 'inspect.html'; return; }
  if (code === '房') { window.location.href = 'checklist.html'; return; }
  if (code === '1') { window.location.href = 'offday.html'; return; }

  // 沒有排班資料，或今天的代碼還沒有對應頁面，退回用固定職務判斷
  const roleName = staff.roles?.name || '';
  if (roleName === '店經理') {
    window.location.href = 'dashboard.html';
  } else if (roleName.includes('房務')) {
    window.location.href = 'checklist.html';
  } else if (roleName === '客務C班') {
    window.location.href = 'inspect.html';
  } else if (roleName === '客務A班' || roleName === '客務B班') {
    window.location.href = 'shift.html';
  } else if (code) {
    alert(`今天班別代碼「${code}」尚未有對應頁面，之後會陸續加上。`);
  } else {
    alert(`目前尚未有對應「${roleName}」的頁面，之後會陸續加上。`);
  }
}
