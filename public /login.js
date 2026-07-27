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
    localStorage.setItem('staff', JSON.stringify(staff));
    routeByRole(staff);
  } catch (err) {
    errorMsg.textContent = err.message;
    loginBtn.textContent = '登入';
    loginBtn.disabled = false;
  }
}

function routeByRole(staff) {
  const roleName = staff.roles?.name || '';
  if (roleName.includes('房務')) {
    window.location.href = 'checklist.html';
  } else if (roleName === '客務C班') {
    window.location.href = 'inspect.html';
  } else {
    alert(`目前尚未有對應「${roleName}」的頁面，之後會陸續加上。`);
  }
}
