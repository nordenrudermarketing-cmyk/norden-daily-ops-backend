const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const isManager = staff.roles?.name === '店經理';
document.getElementById('staffLine').textContent = staff.name;
document.getElementById('workDate').value = new Date().toISOString().slice(0, 10);
document.getElementById('submitBtn').addEventListener('click', submitAppeal);

if (isManager) {
  document.getElementById('managerSection').style.display = 'block';
  document.getElementById('backLink').href = 'dashboard.html';
  loadPending();
}

loadMine();

async function submitAppeal() {
  const workDate = document.getElementById('workDate').value;
  const reason = document.getElementById('reason').value.trim();
  if (!workDate || !reason) { alert('請填申覆日期跟理由'); return; }

  await fetch(`${API}/api/bonus-appeals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.id, branch_id: staff.branch_id, work_date: workDate, reason }),
  });
  document.getElementById('reason').value = '';
  alert('已送出申覆，等待店經理審核');
  loadMine();
}

async function loadMine() {
  const res = await fetch(`${API}/api/bonus-appeals/mine?staff_id=${staff.id}`);
  const list = await res.json();
  const el = document.getElementById('myList');
  if (list.length === 0) { el.innerHTML = '<p class="empty-state">目前沒有申覆紀錄。</p>'; return; }

  const statusLabel = { pending: '待審核', approved: '已核准', rejected: '已駁回' };
  const statusColor = { pending: '#8a6d00', approved: 'var(--accent)', rejected: 'var(--danger)' };
  el.innerHTML = list.map((a) => `
    <div class="card">
      <div class="card-row">
        <span class="card-title">${a.work_date}</span>
        <span class="badge" style="color:${statusColor[a.status]};">${statusLabel[a.status]}</span>
      </div>
      <p class="card-note">${a.reason}</p>
    </div>`).join('');
}

async function loadPending() {
  const res = await fetch(`${API}/api/bonus-appeals/pending?branch_id=${staff.branch_id}`);
  const list = await res.json();
  const el = document.getElementById('pendingList');
  const pending = list.filter((a) => a.status === 'pending');
  if (pending.length === 0) { el.innerHTML = '<p class="empty-state">目前沒有待審核的申覆。</p>'; return; }

  el.innerHTML = '';
  pending.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-row"><span class="card-title">${a.staff?.name || ''}・${a.work_date}</span></div>
      <p class="card-note">${a.reason}</p>
      <div class="action-row"><button class="btn">核准</button><button class="danger-outline">駁回</button></div>`;
    const [approveBtn, rejectBtn] = card.querySelectorAll('button');
    approveBtn.addEventListener('click', () => decide(a.id, 'approved'));
    rejectBtn.addEventListener('click', () => decide(a.id, 'rejected'));
    el.appendChild(card);
  });
}

async function decide(id, status) {
  await fetch(`${API}/api/bonus-appeals/${id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_by: staff.id, status }),
  });
  loadPending();
}
