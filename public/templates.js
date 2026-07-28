const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('addBtn').addEventListener('click', addTemplate);

loadTemplates();

async function loadTemplates() {
  const res = await fetch(`${API}/api/templates/shift-tasks?branch_id=${staff.branch_id}`);
  const templates = await res.json();
  renderTable(templates);
}

function renderTable(templates) {
  const body = document.getElementById('tplBody');
  body.innerHTML = '';

  templates.forEach((t) => {
    const tr = document.createElement('tr');
    if (t.is_active === false) tr.classList.add('inactive');

    const shiftSelect = `<select data-field="shift_code">
      ${['A', 'B', 'C'].map((c) => `<option value="${c}" ${c === t.shift_code ? 'selected' : ''}>${c}班</option>`).join('')}
    </select>`;

    const typeSelect = `<select data-field="schedule_type">
      <option value="daily" ${t.schedule_type === 'daily' ? 'selected' : ''}>每天</option>
      <option value="weekday" ${t.schedule_type === 'weekday' ? 'selected' : ''}>依星期</option>
      <option value="monthly_date" ${t.schedule_type === 'monthly_date' ? 'selected' : ''}>依日期</option>
    </select>`;

    tr.innerHTML = `
      <td>${shiftSelect}</td>
      <td><input type="text" data-field="task_name" value="${t.task_name}"></td>
      <td>${typeSelect}</td>
      <td><input type="text" data-field="schedule_value" value="${t.schedule_value || ''}" placeholder="daily 免填"></td>
      <td><input type="text" data-field="sort_order" value="${t.sort_order || 0}" style="width:50px;"></td>
      <td></td>`;

    const statusTd = tr.lastElementChild;
    const saveBtn = document.createElement('button');
    saveBtn.className = 'small-btn';
    saveBtn.textContent = '儲存';
    saveBtn.style.marginRight = '6px';
    saveBtn.addEventListener('click', () => saveRow(t.id, tr));

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'small-btn';
    toggleBtn.textContent = t.is_active === false ? '重新啟用' : '停用';
    toggleBtn.addEventListener('click', () => toggleActive(t.id, t.is_active === false, toggleBtn, tr));

    statusTd.appendChild(saveBtn);
    statusTd.appendChild(toggleBtn);
    body.appendChild(tr);
  });
}

async function saveRow(id, tr) {
  const get = (field) => tr.querySelector(`[data-field="${field}"]`).value;
  const payload = {
    shift_code: get('shift_code'),
    task_name: get('task_name'),
    schedule_type: get('schedule_type'),
    schedule_value: get('schedule_value') || null,
    sort_order: Number(get('sort_order')) || 0,
  };

  const res = await fetch(`${API}/api/templates/shift-tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert((await res.json()).error || '儲存失敗'); return; }
  alert('已儲存');
}

async function toggleActive(id, nextActive, btn, tr) {
  const res = await fetch(`${API}/api/templates/shift-tasks/${id}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: nextActive }),
  });
  if (!res.ok) { alert((await res.json()).error || '操作失敗'); return; }
  tr.classList.toggle('inactive', !nextActive);
  btn.textContent = nextActive ? '停用' : '重新啟用';
}

async function addTemplate() {
  const payload = {
    branch_id: staff.branch_id,
    shift_code: document.getElementById('newShift').value,
    task_name: document.getElementById('newName').value.trim(),
    schedule_type: document.getElementById('newType').value,
    schedule_value: document.getElementById('newValue').value.trim() || null,
    sort_order: 0,
  };
  if (!payload.task_name) { alert('請填任務名稱'); return; }

  const res = await fetch(`${API}/api/templates/shift-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert((await res.json()).error || '新增失敗'); return; }

  document.getElementById('newName').value = '';
  document.getElementById('newValue').value = '';
  loadTemplates();
}
