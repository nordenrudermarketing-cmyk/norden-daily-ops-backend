const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const STALE_THRESHOLD_DAYS = 7;

document.getElementById('staffLine').textContent = staff.name;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('staff');
  window.location.href = 'index.html';
});
document.getElementById('taskSubmit').addEventListener('click', submitTask);

let branchList = [];

init();

async function init() {
  await loadOverview();
  await loadTasks();
}

async function loadOverview() {
  const grid = document.getElementById('branchGrid');
  grid.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/hq/overview`);
  const overview = await res.json();
  branchList = overview.map((b) => ({ id: b.branch_id, name: b.branch_name }));

  const branchSelect = document.getElementById('taskBranch');
  branchSelect.innerHTML = branchList.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');

  grid.innerHTML = '';
  overview.forEach((b) => {
    const isStale = (b.oldest_anomaly_days ?? 0) >= STALE_THRESHOLD_DAYS || (b.oldest_defect_days ?? 0) >= STALE_THRESHOLD_DAYS;
    const card = document.createElement('div');
    card.className = 'branch-card' + (isStale ? ' stale' : '');

    card.innerHTML = `
      <h3>${b.branch_name}${isStale ? ' ⚠' : ''}</h3>
      <div class="metric-line"><span>今日房務完成</span><span class="val">${b.rooms_completed} / ${b.rooms_total}</span></div>
      <div class="metric-line"><span>未處理異常</span><span class="val ${b.unresolved_anomalies > 0 ? 'warn' : ''}">${b.unresolved_anomalies}${b.oldest_anomaly_days !== null ? `（最久 ${b.oldest_anomaly_days} 天）` : ''}</span></div>
      <div class="metric-line"><span>未處理缺失</span><span class="val ${b.unresolved_defects > 0 ? 'warn' : ''}">${b.unresolved_defects}${b.oldest_defect_days !== null ? `（最久 ${b.oldest_defect_days} 天）` : ''}</span></div>
      <div class="metric-line"><span>店經理巡館完成</span><span class="val">${b.manager_checklist_done} / 8</span></div>
      <div class="metric-line"><span>待處理總公司任務</span><span class="val ${b.pending_hq_tasks > 0 ? 'warn' : ''}">${b.pending_hq_tasks}</span></div>
    `;
    grid.appendChild(card);
  });
}

async function loadTasks() {
  const res = await fetch(`${API}/api/hq/tasks`);
  const tasks = await res.json();
  const body = document.querySelector('#taskTable tbody');

  if (tasks.length === 0) {
    body.innerHTML = '<tr><td colspan="5" style="color:var(--ink-soft);">還沒有交辦任務</td></tr>';
    return;
  }

  body.innerHTML = tasks.map((t) => `
    <tr>
      <td>${t.branches?.name || ''}</td>
      <td>${t.title}</td>
      <td>${t.due_date || '—'}</td>
      <td>${t.status === 'completed' ? '已完成' : '待處理'}</td>
      <td>${t.response_notes || ''}</td>
    </tr>`).join('');
}

async function submitTask() {
  const payload = {
    title: document.getElementById('taskTitle').value.trim(),
    description: document.getElementById('taskDesc').value,
    target_branch_id: document.getElementById('taskBranch').value,
    due_date: document.getElementById('taskDue').value || null,
    assigned_by: document.getElementById('taskAssignedBy').value,
  };
  if (!payload.title) { alert('請填標題'); return; }

  const res = await fetch(`${API}/api/hq/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert((await res.json()).error || '送出失敗'); return; }

  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskDue').value = '';
  loadTasks();
  loadOverview();
}
