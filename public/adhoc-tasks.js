const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const isManager = staff.roles?.name === '店經理';
document.getElementById('backLink').href = isManager ? 'dashboard.html' : 'checklist.html';
if (isManager) document.getElementById('managerCreate').style.display = 'block';
document.getElementById('createBtn').addEventListener('click', createTask);
document.getElementById('taskSelect').addEventListener('change', loadRoomTable);

let staffOptions = [];

init();

async function init() {
  staffOptions = await fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}`).then((r) => r.json());
  await loadTasks();
}

async function loadTasks() {
  const res = await fetch(`${API}/api/adhoc-tasks?branch_id=${staff.branch_id}`);
  const tasks = await res.json();
  const select = document.getElementById('taskSelect');
  select.innerHTML = tasks.map((t) => `<option value="${t.id}">${t.title}${t.due_date ? '（期限 ' + t.due_date + '）' : ''}</option>`).join('');
  if (tasks.length > 0) loadRoomTable();
  else document.getElementById('roomsTable').innerHTML = '<tr><td>目前沒有任何臨時任務。</td></tr>';
}

async function createTask() {
  const title = document.getElementById('newTitle').value.trim();
  if (!title) { alert('請填任務標題'); return; }

  const btn = document.getElementById('createBtn');
  btn.textContent = '建立中…';
  btn.disabled = true;

  try {
    await fetch(`${API}/api/adhoc-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: staff.branch_id,
        title,
        description: document.getElementById('newDesc').value,
        due_date: document.getElementById('newDue').value || null,
        created_by: staff.id,
      }),
    });
    document.getElementById('newTitle').value = '';
    document.getElementById('newDesc').value = '';
    document.getElementById('newDue').value = '';
    await loadTasks();
  } finally {
    btn.textContent = '建立任務（自動帶入全館房號）';
    btn.disabled = false;
  }
}

async function loadRoomTable() {
  const taskId = document.getElementById('taskSelect').value;
  if (!taskId) return;
  const table = document.getElementById('roomsTable');
  table.innerHTML = '<tr><td>載入中…</td></tr>';

  const res = await fetch(`${API}/api/adhoc-tasks/${taskId}/rooms`);
  const rows = await res.json();

  let html = '<thead><tr><th>房號</th><th>負責人</th><th>狀態</th></tr></thead><tbody>';
  rows.forEach((r) => {
    const isDone = r.status === 'completed';
    html += `<tr class="${isDone ? 'done' : ''}" data-id="${r.id}">
      <td>${r.room?.room_number || ''}</td>
      <td class="assign-cell"></td>
      <td class="status-cell"></td>
    </tr>`;
  });
  html += '</tbody>';
  table.innerHTML = html;

  rows.forEach((r) => {
    const tr = table.querySelector(`tr[data-id="${r.id}"]`);
    const assignCell = tr.querySelector('.assign-cell');
    const statusCell = tr.querySelector('.status-cell');
    const isDone = r.status === 'completed';

    if (isDone) {
      assignCell.textContent = r.assignee?.name || '未指派';
      statusCell.innerHTML = `✓ 已完成（${r.completer?.name || ''}）`;
      statusCell.style.cursor = 'pointer';
      statusCell.addEventListener('click', () => {
        if (confirm('這間房已標記完成，要取消嗎？')) undoRoom(r.id);
      });
    } else {
      const select = document.createElement('select');
      select.innerHTML = '<option value="">未指派</option>' +
        staffOptions.map((s) => `<option value="${s.id}" ${s.id === r.assigned_to ? 'selected' : ''}>${s.name}</option>`).join('');
      select.addEventListener('change', () => assignRoom(r.id, select.value));
      assignCell.appendChild(select);

      const btn = document.createElement('button');
      btn.textContent = '標記完成';
      btn.addEventListener('click', () => completeRoom(r.id));
      statusCell.appendChild(btn);
    }
  });
}

async function assignRoom(assignmentId, staffId) {
  await fetch(`${API}/api/adhoc-tasks/assignments/${assignmentId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staffId }),
  });
}

async function completeRoom(assignmentId) {
  await fetch(`${API}/api/adhoc-tasks/assignments/${assignmentId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.id }),
  });
  loadRoomTable();
}

async function undoRoom(assignmentId) {
  await fetch(`${API}/api/adhoc-tasks/assignments/${assignmentId}/undo`, { method: 'POST' });
  loadRoomTable();
}
