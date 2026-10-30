// 職務管理（只有總辦公室）——後端見 gas/Org.gs
// 職務只決定自評題目（共同題目＋選定的專屬題目類別），跟權限無關；不能刪除，只能停用

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const $ = (id) => document.getElementById(id);

let categories = []; // 題目類別：[{ key, roleLabel }]

if (!staff) {
  window.location.href = 'index.html';
} else if (window.accountLevelOf(staff) !== 'office') {
  alert('職務管理只有總辦公室帳號可以使用');
  window.location.href = 'index.html';
} else {
  $('staffLine').textContent = staff.name;
  $('addBtn').addEventListener('click', add);
  load();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function setStatus(text, isError = false) {
  $('statusLine').textContent = text;
  $('statusLine').className = 'status-line' + (isError ? ' err' : '');
}

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API}/api/org/roles${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '操作失敗，請稍後再試');
  return data;
}

function categoryOptions(selected) {
  return categories.map((c) =>
    `<option value="${c.key}" ${c.key === selected ? 'selected' : ''}>${escapeHtml(c.roleLabel)}</option>`).join('');
}

async function load() {
  try {
    const data = await api('');
    categories = data.categories;
    $('newCategory').innerHTML = categoryOptions('common');
    render(data.roles);
  } catch (err) {
    $('list').innerHTML = '';
    setStatus(err.message, true);
  }
}

function render(list) {
  if (!list.length) {
    $('list').innerHTML = '<p class="empty-state">還沒有任何職務</p>';
    return;
  }
  $('list').innerHTML = list.map((r) => `
    <div class="org-row ${r.is_active ? '' : 'inactive'}" data-id="${r.id}">
      <input type="text" class="name" value="${escapeHtml(r.name)}" data-field="name">
      <select data-field="template_category">${categoryOptions(r.template_category)}</select>
      <span class="meta">在職 ${r.staff_count} 人${r.is_active ? '' : '・已停用'}</span>
      <button data-act="save">儲存</button>
      <button data-act="toggle" class="${r.is_active ? 'danger' : ''}">${r.is_active ? '停用' : '重新啟用'}</button>
    </div>`).join('');

  $('list').querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.org-row');
      const role = list.find((r) => r.id === row.dataset.id);
      if (btn.dataset.act === 'save') {
        run(() => api(`/${role.id}`, 'PUT', {
          name: row.querySelector('[data-field="name"]').value,
          template_category: row.querySelector('[data-field="template_category"]').value,
        }), '已儲存');
      } else {
        run(() => api(`/${role.id}`, 'PUT', { is_active: !role.is_active }),
          role.is_active ? `已停用「${role.name}」` : `已重新啟用「${role.name}」`);
      }
    });
  });
}

async function add() {
  const name = $('newName').value.trim();
  if (!name) { setStatus('請填寫職務名稱', true); return; }
  await run(() => api('', 'POST', { name, template_category: $('newCategory').value }), `已新增「${name}」`);
  $('newName').value = '';
}

async function run(fn, successText) {
  setStatus('處理中…');
  try {
    await fn();
    setStatus(successText);
    await load();
  } catch (err) {
    setStatus(err.message, true);
  }
}
