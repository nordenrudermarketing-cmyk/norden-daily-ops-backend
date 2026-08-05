const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const isHQ = staff.roles?.name === '總公司';
if (!isHQ) {
  alert('密碼管理僅限總公司使用');
  window.location.href = 'index.html';
}

document.getElementById('staffLine').textContent = staff.name;
document.getElementById('backLink').href = 'hq-dashboard.html';

load();

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  // 總公司看得到全部館別；店經理只看得到自己館別
  const url = isHQ
    ? `${API}/api/staff/password-status`
    : `${API}/api/staff/password-status?branch_id=${staff.branch_id}`;
  const res = await fetch(url);
  const staffList = await res.json();

  listEl.innerHTML = '';
  staffList.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'staff-row';
    row.innerHTML = `
      <div>
        <p class="info" style="margin:0;">${s.name}</p>
        <p class="meta" style="margin:2px 0 0;">${isHQ ? (s.branch_name || '') + '・' : ''}${s.role_name || ''}</p>
      </div>
      <div class="row-right">
        <span class="status-badge ${s.has_password ? 'set' : 'unset'}">${s.has_password ? '已設定密碼' : '尚未設定'}</span>
        ${s.has_password ? `<button class="reset-btn" data-id="${s.id}" data-name="${s.name}">重設</button>` : ''}
      </div>`;
    listEl.appendChild(row);
  });

  listEl.querySelectorAll('.reset-btn').forEach((btn) => {
    btn.addEventListener('click', () => resetPassword(btn.dataset.id, btn.dataset.name));
  });
}

async function resetPassword(staffId, name) {
  if (!confirm(`確定要重設「${name}」的密碼嗎？重設後對方下次登入需要重新設定新密碼。`)) return;
  await fetch(`${API}/api/staff/${staffId}/reset-password`, { method: 'POST' });
  alert(`已重設「${name}」的密碼`);
  load();
}
