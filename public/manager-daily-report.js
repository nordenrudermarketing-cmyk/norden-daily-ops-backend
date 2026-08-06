const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
document.getElementById('openBtn').addEventListener('click', openReport);
document.getElementById('addMemoBtn').addEventListener('click', addMemo);

const STATUS_LABEL = { todo: '待辦', in_progress: '追蹤中', done: '已完成' };

load();
loadMemo();

async function load() {
  const res = await fetch(`${API}/api/manager-reports/today?branch_id=${staff.branch_id}&date=${today}`);
  const data = await res.json();
  if (!data) return;
  document.getElementById('plannedTasks').value = data.planned_tasks || '';
  if (data.opened_at) {
    document.getElementById('openedInfo').textContent = `已於 ${new Date(data.opened_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 開班`;
  }
}

async function openReport() {
  await fetch(`${API}/api/manager-reports/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: staff.branch_id,
      work_date: today,
      planned_tasks: document.getElementById('plannedTasks').value,
      staff_id: staff.id,
    }),
  });
  document.getElementById('openedInfo').style.color = 'var(--accent)';
  document.getElementById('openedInfo').textContent = '已送出開班紀錄';
}

async function addMemo() {
  const content = document.getElementById('newMemoContent').value.trim();
  if (!content) { alert('請填內容'); return; }
  const status = document.getElementById('newMemoStatus').value;

  await fetch(`${API}/api/manager-memo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch_id: staff.branch_id, staff_id: staff.id, content, status }),
  });
  document.getElementById('newMemoContent').value = '';
  document.getElementById('newMemoStatus').value = 'todo';
  loadMemo();
}

async function loadMemo() {
  const res = await fetch(`${API}/api/manager-memo/list?branch_id=${staff.branch_id}`);
  const items = await res.json();

  const active = items.filter((i) => i.status !== 'done');
  const done = items.filter((i) => i.status === 'done');

  document.getElementById('memoActiveList').innerHTML = active.length === 0
    ? '<p class="empty-state">目前沒有待辦或追蹤中的項目。</p>'
    : active.map(renderCard).join('');

  document.getElementById('memoDoneList').innerHTML = done.length === 0
    ? '<p class="empty-state">還沒有已完成的項目。</p>'
    : done.map(renderCard).join('');

  document.querySelectorAll('[data-status-select]').forEach((sel) => {
    sel.addEventListener('change', () => updateStatus(sel.dataset.statusSelect, sel.value));
  });
}

function renderCard(item) {
  const badgeColor = item.status === 'done' ? 'var(--accent)' : item.status === 'in_progress' ? '#8a6d00' : 'var(--danger)';
  const badgeBg = item.status === 'done' ? 'var(--accent-soft)' : item.status === 'in_progress' ? '#fff6e0' : 'var(--danger-soft)';
  return `
    <div class="card" style="${item.status === 'done' ? 'opacity:0.6;' : ''}">
      <div class="card-row">
        <span class="card-title">${item.content}</span>
        <span class="badge" style="background:${badgeBg};color:${badgeColor};">${STATUS_LABEL[item.status]}</span>
      </div>
      <p class="card-meta">${item.staff?.name || ''}・${new Date(item.created_at).toLocaleDateString('zh-TW')}</p>
      <select data-status-select="${item.id}" style="margin-top:6px;padding:4px;border:1px solid var(--line);border-radius:6px;font-size:12px;">
        <option value="todo" ${item.status === 'todo' ? 'selected' : ''}>待辦</option>
        <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>追蹤中</option>
        <option value="done" ${item.status === 'done' ? 'selected' : ''}>已完成</option>
      </select>
    </div>`;
}

async function updateStatus(id, status) {
  await fetch(`${API}/api/manager-memo/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  loadMemo();
}
