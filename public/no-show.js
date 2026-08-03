const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
document.getElementById('addBtn').addEventListener('click', addRecord);

load();

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';
  const res = await fetch(`${API}/api/no-show?branch_id=${staff.branch_id}&date=${today}`);
  const items = await res.json();

  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty-state">今天還沒有紀錄。</p>';
    return;
  }

  listEl.innerHTML = items.map((it) => `
    <div class="card">
      <div class="card-row">
        <span class="card-title">${it.guest_info}${it.room_type ? '・' + it.room_type : ''}</span>
        <span class="badge" style="background:${it.charged ? 'var(--accent-soft)' : 'var(--danger-soft)'};color:${it.charged ? 'var(--accent)' : 'var(--danger)'};">${it.charged ? '已收費 $' + (it.amount || 0) : '未收費'}</span>
      </div>
      ${it.note ? `<p class="card-note" style="color:var(--ink);">${it.note}</p>` : ''}
      <p class="card-meta">${it.staff?.name || ''}・${new Date(it.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>`).join('');
}

async function addRecord() {
  const guestInfo = document.getElementById('guestInfo').value.trim();
  if (!guestInfo) { alert('請填訂單/客人資訊'); return; }

  await fetch(`${API}/api/no-show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: staff.branch_id,
      work_date: today,
      guest_info: guestInfo,
      room_type: document.getElementById('roomType').value,
      charged: document.getElementById('charged').checked,
      amount: Number(document.getElementById('amount').value) || null,
      note: document.getElementById('note').value,
      reported_by: staff.id,
    }),
  });

  document.getElementById('guestInfo').value = '';
  document.getElementById('roomType').value = '';
  document.getElementById('charged').checked = false;
  document.getElementById('amount').value = '';
  document.getElementById('note').value = '';
  load();
}
