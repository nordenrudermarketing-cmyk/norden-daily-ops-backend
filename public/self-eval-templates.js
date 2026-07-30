const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CATEGORY_LABEL = { common: '全部門共同', management: '主管職專屬', housekeeping: '房務部門專屬', frontdesk: '客務部門專屬' };

document.getElementById('addBtn').addEventListener('click', addTemplate);

loadTemplates();

async function loadTemplates() {
  const res = await fetch(`${API}/api/self-eval/templates`);
  const templates = await res.json();
  renderTable(templates);
}

function renderTable(templates) {
  const body = document.getElementById('tplBody');
  body.innerHTML = '';

  templates.forEach((t) => {
    const tr = document.createElement('tr');
    if (t.is_active === false) tr.classList.add('inactive');

    const catSelect = `<select data-field="category">
      ${Object.entries(CATEGORY_LABEL).map(([v, label]) => `<option value="${v}" ${v === t.category ? 'selected' : ''}>${label}</option>`).join('')}
    </select>`;

    tr.innerHTML = `
      <td>${catSelect}</td>
      <td><textarea data-field="question_zh">${t.question_zh}</textarea></td>
      <td><textarea data-field="question_id">${t.question_id || ''}</textarea></td>
      <td><input type="text" data-field="sort_order" value="${t.sort_order || 0}"></td>
      <td></td>`;

    const statusTd = tr.lastElementChild;
    const saveBtn = document.createElement('button');
    saveBtn.className = 'small-btn';
    saveBtn.textContent = '儲存';
    saveBtn.addEventListener('click', () => saveRow(t.id, tr));

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'small-btn';
    toggleBtn.textContent = t.is_active === false ? '重新啟用' : '停用';
    toggleBtn.addEventListener('click', () => {
      const currentlyInactive = tr.classList.contains('inactive');
      toggleActive(t.id, currentlyInactive, toggleBtn, tr);
    });

    statusTd.appendChild(saveBtn);
    statusTd.appendChild(toggleBtn);
    body.appendChild(tr);
  });
}

async function saveRow(id, tr) {
  const get = (field) => tr.querySelector(`[data-field="${field}"]`).value;
  const payload = {
    category: get('category'),
    question_zh: get('question_zh'),
    question_id: get('question_id') || null,
    sort_order: Number(get('sort_order')) || 0,
  };

  const res = await fetch(`${API}/api/self-eval/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert((await res.json()).error || '儲存失敗'); return; }
  alert('已儲存');
}

async function toggleActive(id, nextActive, btn, tr) {
  const res = await fetch(`${API}/api/self-eval/templates/${id}/toggle`, {
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
    category: document.getElementById('newCategory').value,
    question_zh: document.getElementById('newZh').value.trim(),
    question_id: document.getElementById('newId').value.trim() || null,
    sort_order: 0,
  };
  if (!payload.question_zh) { alert('請填題目內容'); return; }

  const res = await fetch(`${API}/api/self-eval/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert((await res.json()).error || '新增失敗'); return; }

  document.getElementById('newZh').value = '';
  document.getElementById('newId').value = '';
  loadTemplates();
}
