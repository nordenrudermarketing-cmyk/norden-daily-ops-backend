const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

let frontdeskStaff = [];

document.getElementById('addBtn').addEventListener('click', addTask);

init();

async function init() {
  frontdeskStaff = await fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}&category=frontdesk`).then((r) => r.json());
  loadTasks();
}

async function loadTasks() {
  const res = await fetch(`${API}/api/routine-tasks?branch_id=${staff.branch_id}`);
  const tasks = await res.json();
  renderTable(tasks);
}

function renderTable(tasks) {
  const body = document.getElementById('rtBody');
  body.innerHTML = '';

  tasks.forEach((t) => {
    const tr = document.createElement('tr');
    if (t.status === 'completed') tr.classList.add('completed');

    const staffSelect = `<select data-field="assigned_to">
      <option value="">未指派</option>
      ${frontdeskStaff.map((s) => `<option value="${s.id}" ${s.id === t.assigned_to ? 'selected' : ''}>${s.name}</option>`).join('')}
    </select>`;

    const statusSelect = `<select data-field="status">
      <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>待處理</option>
      <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>進行中</option>
      <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>已完成</option>
    </select>`;

    tr.innerHTML = `
      <td><input type="text" data-field="category" value="${t.category}"></td>
      <td><input type="text" data-field="item_name" value="${t.item_name}"></td>
      <td><input type="text" data-field="week_note" value="${t.week_note || ''}"></td>
      <td>${staffSelect}</td>
      <td><input type="text" data-field="due_date" value="${t.due_date || ''}" placeholder="YYYY-MM-DD"></td>
      <td>${statusSelect}</td>
      <td><textarea data-field="progress_note">${t.progress_note || ''}</textarea><button class="small-btn" style="margin-top:4px;">儲存</button></td>`;

    tr.querySelector('.small-btn').addEventListener('click', () => saveRow(t.id, tr));
    body.appendChild(tr);
  });
}

async function saveRow(id, tr) {
  const get = (field) => tr.querySelector(`[data-field="${field}"]`).value;
  const payload = {
    category: get('category'),
    item_name: get('item_name'),
    week_note: get('week_note'),
    assigned_to: get('assigned_to') || null,
    due_date: get('due_date') || null,
    status: get('status'),
    progress_note: get('progress_note'),
  };
  const res = await fetch(`${API}/api/routine-tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert((await res.json()).error || '儲存失敗'); return; }
  alert('已儲存');
  loadTasks();
}

async function addTask() {
  const payload = {
    branch_id: staff.branch_id,
    category: document.getElementById('newCategory').value,
    item_name: document.getElementById('newName').value.trim(),
    week_note: document.getElementById('newWeek').value,
    due_date: document.getElementById('newDue').value || null,
  };
  if (!payload.item_name) { alert('請填項目名稱'); return; }

  const res = await fetch(`${API}/api/routine-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert((await res.json()).error || '新增失敗'); return; }

  document.getElementById('newName').value = '';
  document.getElementById('newWeek').value = '';
  document.getElementById('newDue').value = '';
  loadTasks();
}
