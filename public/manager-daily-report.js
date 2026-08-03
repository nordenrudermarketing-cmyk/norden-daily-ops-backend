const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
document.getElementById('openBtn').addEventListener('click', openReport);
document.getElementById('closeBtn').addEventListener('click', closeReport);

load();

async function load() {
  const res = await fetch(`${API}/api/manager-reports/today?branch_id=${staff.branch_id}&date=${today}`);
  const data = await res.json();
  if (!data) return;

  document.getElementById('plannedTasks').value = data.planned_tasks || '';
  document.getElementById('completedItems').value = data.completed_items || '';
  document.getElementById('pendingItems').value = data.pending_items || '';
  document.getElementById('spotChecks').value = data.spot_checks || '';
  document.getElementById('hqNotes').value = data.hq_notes || '';

  if (data.opened_at) {
    document.getElementById('openedInfo').textContent = `已於 ${new Date(data.opened_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 開班`;
  }
  if (data.closed_at) {
    document.getElementById('closedInfo').textContent = `已於 ${new Date(data.closed_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 收班`;
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

async function closeReport() {
  await fetch(`${API}/api/manager-reports/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: staff.branch_id,
      work_date: today,
      completed_items: document.getElementById('completedItems').value,
      pending_items: document.getElementById('pendingItems').value,
      spot_checks: document.getElementById('spotChecks').value,
      hq_notes: document.getElementById('hqNotes').value,
      staff_id: staff.id,
    }),
  });
  document.getElementById('closedInfo').style.color = 'var(--accent)';
  document.getElementById('closedInfo').textContent = '已送出收班紀錄';
}
