// 部門管理（只有總辦公室）——後端見 gas/Org.gs
// 部門只用來歸屬、分組、統計；不能刪除，只能停用（還有在職同仁的部門不能停用）

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const $ = (id) => document.getElementById(id);

if (!staff) {
  window.location.href = 'index.html';
} else if (window.accountLevelOf(staff) !== 'office') {
  alert('部門管理只有總辦公室帳號可以使用');
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
  const res = await fetch(`${API}/api/org/departments${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '操作失敗，請稍後再試');
  return data;
}

async function load() {
  try {
    render(await api(''));
  } catch (err) {
    $('list').innerHTML = '';
    setStatus(err.message, true);
  }
}

function render(list) {
  if (!list.length) {
    $('list').innerHTML = '<p class="empty-state">還沒有任何部門</p>';
    return;
  }
  $('list').innerHTML = list.map((d) => `
    <div class="org-row ${d.is_active ? '' : 'inactive'}" data-id="${d.id}">
      <input type="text" class="name" value="${escapeHtml(d.name)}" data-field="name">
      <input type="text" class="code" value="${escapeHtml(d.code || '')}" data-field="code" placeholder="代碼">
      <span class="meta">在職 ${d.staff_count} 人${d.is_active ? '' : '・已停用'}</span>
      <button data-act="save">儲存</button>
      <button data-act="toggle" class="${d.is_active ? 'danger' : ''}">${d.is_active ? '停用' : '重新啟用'}</button>
    </div>`).join('');

  $('list').querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.org-row');
      const dept = list.find((d) => d.id === row.dataset.id);
      if (btn.dataset.act === 'save') {
        run(() => api(`/${dept.id}`, 'PUT', {
          name: row.querySelector('[data-field="name"]').value,
          code: row.querySelector('[data-field="code"]').value,
        }), '已儲存');
      } else {
        run(() => api(`/${dept.id}`, 'PUT', { is_active: !dept.is_active }),
          dept.is_active ? `已停用「${dept.name}」` : `已重新啟用「${dept.name}」`);
      }
    });
  });
}

async function add() {
  const name = $('newName').value.trim();
  if (!name) { setStatus('請填寫部門名稱', true); return; }
  await run(() => api('', 'POST', { name, code: $('newCode').value.trim() }), `已新增「${name}」`);
  $('newName').value = '';
  $('newCode').value = '';
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
