const API = window.APP_CONFIG.API_BASE_URL;

const loginCodeInput = document.getElementById('loginCode');
const nextBtn = document.getElementById('nextBtn');
const loginBtn = document.getElementById('loginBtn');
const setPasswordBtn = document.getElementById('setPasswordBtn');
const backBtn1 = document.getElementById('backBtn1');
const backBtn2 = document.getElementById('backBtn2');
const errorMsg = document.getElementById('errorMsg');
const stepHint = document.getElementById('stepHint');

const stepCode = document.getElementById('stepCode');
const stepPassword = document.getElementById('stepPassword');
const stepSetPassword = document.getElementById('stepSetPassword');

let currentLoginCode = '';

// 已登入就直接跳轉，不用重新輸入
const savedStaff = localStorage.getItem('staff');
if (savedStaff) routeByRole(JSON.parse(savedStaff));

nextBtn.addEventListener('click', checkCode);
loginCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkCode(); });
loginBtn.addEventListener('click', doLogin);
document.getElementById('passwordInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
setPasswordBtn.addEventListener('click', doSetPassword);
backBtn1.addEventListener('click', backToCode);
backBtn2.addEventListener('click', backToCode);

function backToCode() {
  errorMsg.textContent = '';
  stepCode.style.display = 'block';
  stepPassword.style.display = 'none';
  stepSetPassword.style.display = 'none';
  stepHint.textContent = '每日營運系統・請輸入登入代碼';
}

// 第一步：查這個登入代碼有沒有設定過密碼
async function checkCode() {
  errorMsg.textContent = '';
  const code = loginCodeInput.value.trim();
  if (!code) { errorMsg.textContent = '請輸入登入代碼'; return; }

  nextBtn.textContent = '查詢中…';
  nextBtn.disabled = true;

  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_code: code }),
    });
    const result = await res.json();

    if (res.status === 401 && !result.needs_password) {
      throw new Error(result.error || '登入代碼錯誤');
    }

    currentLoginCode = code;
    stepCode.style.display = 'none';

    if (result.needs_password_setup) {
      stepSetPassword.style.display = 'block';
      stepHint.textContent = '第一次登入';
      document.getElementById('newPassword').focus();
    } else {
      stepPassword.style.display = 'block';
      stepHint.textContent = '請輸入密碼';
      document.getElementById('passwordInput').focus();
    }
  } catch (err) {
    errorMsg.textContent = err.message;
  } finally {
    nextBtn.textContent = '下一步';
    nextBtn.disabled = false;
  }
}

async function doSetPassword() {
  errorMsg.textContent = '';
  const p1 = document.getElementById('newPassword').value;
  const p2 = document.getElementById('confirmPassword').value;
  if (!p1) { errorMsg.textContent = '請設定密碼'; return; }
  if (p1 !== p2) { errorMsg.textContent = '兩次輸入的密碼不一致'; return; }

  setPasswordBtn.textContent = '設定中…';
  setPasswordBtn.disabled = true;

  try {
    const res = await fetch(`${API}/api/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_code: currentLoginCode, password: p1 }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '設定失敗');

    // 設定完直接用這組密碼登入
    await completeLogin(p1);
  } catch (err) {
    errorMsg.textContent = err.message;
    setPasswordBtn.textContent = '設定並登入';
    setPasswordBtn.disabled = false;
  }
}

async function doLogin() {
  errorMsg.textContent = '';
  const password = document.getElementById('passwordInput').value;
  if (!password) { errorMsg.textContent = '請輸入密碼'; return; }

  loginBtn.textContent = '登入中…';
  loginBtn.disabled = true;

  try {
    await completeLogin(password);
  } catch (err) {
    errorMsg.textContent = err.message;
    loginBtn.textContent = '登入';
    loginBtn.disabled = false;
  }
}

async function completeLogin(password) {
  const res = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_code: currentLoginCode, password }),
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
}

function routeByRole(staff) {
  const code = staff.todayShiftCode;

  // 優先依今天實際排班的班別導向
  if (code === 'A' || code === 'B') { window.location.href = 'shift.html'; return; }
  if (code === 'C') { window.location.href = 'inspect.html'; return; }
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
