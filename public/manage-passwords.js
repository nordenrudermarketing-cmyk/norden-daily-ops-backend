// 帳號管理（檔名沿用 manage-passwords，原本連到「密碼管理」的連結才不會壞掉）
// 總公司：所有館別、所有職務；店經理：自己館別的房務、客務，自己的帳號只能改密碼
// 權限由後端 /api/accounts 依資料庫裡的真實職務判斷，這裡只負責畫面

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const roleName = staff?.roles?.name;
const isHQ = roleName === '總公司';

const $ = (id) => document.getElementById(id);

let meta = { branches: [], roles: [] };
let accounts = [];
let editingId = null; // null 代表新增
let pwTargetId = null;

if (!staff) {
  window.location.href = 'index.html';
} else if (roleName !== '總公司' && roleName !== '店經理') {
  alert('帳號管理只有總公司和店經理可以使用');
  window.location.href = 'index.html';
} else {
  init();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 所有請求都帶上 actor_id，後端用它查「現在是誰在操作」
async function api(path, method = 'GET', body) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}/api/accounts${path}${sep}actor_id=${encodeURIComponent(staff.id)}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '操作失敗，請稍後再試');
  return data;
}

function setStatus(text, isError = false) {
  $('statusLine').textContent = text;
  $('statusLine').className = 'status-line' + (isError ? ' err' : '');
}

async function init() {
  $('staffLine').textContent = staff.name;
  $('search').addEventListener('input', render);
  $('branchFilter').addEventListener('change', render);
  $('showInactive').addEventListener('change', render);
  $('addBtn').addEventListener('click', () => openEdit(null));
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
  $('editForm').addEventListener('submit', saveEdit);
  $('pwForm').addEventListener('submit', savePassword);
  $('pwShow').addEventListener('change', () => {
    $('pwInput').type = $('pwShow').checked ? 'text' : 'password';
  });

  try {
    meta = await api('/meta');
  } catch (err) {
    setStatus(err.message, true);
    return;
  }

  if (isHQ) {
    $('scopeLine').textContent = '你可以管理：全部館別、所有職務的帳號';
    $('branchFilter').style.display = '';
    $('branchFilter').innerHTML = '<option value="">全部館別</option>' +
      meta.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  } else {
    const branchName = meta.branches[0]?.name || '自己館別';
    $('scopeLine').textContent = `你可以管理：${branchName}的房務、客務帳號（自己的帳號可以改密碼）`;
  }

  await load();
}

async function load() {
  $('list').innerHTML = '<p class="empty-state">載入中…</p>';
  try {
    accounts = await api('');
    render();
  } catch (err) {
    $('list').innerHTML = '';
    setStatus(err.message, true);
  }
}

function render() {
  const keyword = $('search').value.trim().toLowerCase();
  const branchId = $('branchFilter').value;
  const showInactive = $('showInactive').checked;

  $('inactiveCount').textContent = accounts.filter((a) => !a.is_active).length;

  const rows = accounts.filter((a) =>
    (showInactive || a.is_active) &&
    (!branchId || a.branch_id === branchId) &&
    (!keyword ||
      a.name.toLowerCase().includes(keyword) ||
      (a.login_code || '').toLowerCase().includes(keyword))
  );

  if (rows.length === 0) {
    $('list').innerHTML = '<p class="empty-state">沒有符合條件的帳號</p>';
    return;
  }

  $('list').innerHTML = rows.map((a) => `
    <div class="acct-row ${a.is_active ? '' : 'inactive'}" data-id="${a.id}">
      <div>
        <p class="acct-name">${escapeHtml(a.name)}${a.is_self ? '<span class="badge muted">你自己</span>' : ''}${a.is_active ? '' : '<span class="badge muted">已停用</span>'}${a.is_part_time ? '<span class="badge muted">兼職</span>' : ''}</p>
        <p class="acct-meta">
          登入代碼：${escapeHtml(a.login_code || '—')}　${escapeHtml(a.branch_name || '')}・${escapeHtml(a.role_name || '')}
          <span class="badge ${a.has_password ? 'ok' : 'warn'}">${a.has_password ? '已設定密碼' : '尚未設定密碼'}</span>
        </p>
      </div>
      <div class="acct-actions">
        ${a.can_edit ? '<button data-act="edit">編輯</button>' : ''}
        ${a.can_set_password ? '<button data-act="password">設定密碼</button>' : ''}
        ${a.can_edit && a.has_password && !a.is_self ? '<button data-act="reset">清空密碼</button>' : ''}
        ${a.can_deactivate && a.is_active ? '<button data-act="deactivate" class="danger">停用</button>' : ''}
        ${a.can_deactivate && !a.is_active ? '<button data-act="activate">重新啟用</button>' : ''}
        ${a.can_hard_delete ? '<button data-act="delete" class="danger">永久刪除</button>' : ''}
      </div>
    </div>`).join('');

  $('list').querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const account = accounts.find((a) => a.id === btn.closest('.acct-row').dataset.id);
      if (account) ACTIONS[btn.dataset.act](account);
    });
  });
}

const ACTIONS = {
  edit: (a) => openEdit(a),
  password: (a) => openPassword(a),
  reset: (a) => {
    if (!confirm(`確定要清空「${a.name}」的密碼嗎？\n清空後，對方下次登入時輸入的密碼會直接變成新密碼。`)) return;
    runAction(() => api(`/${a.id}/reset-password`, 'POST'), `已清空「${a.name}」的密碼`);
  },
  deactivate: (a) => {
    if (!confirm(`確定要停用「${a.name}」嗎？\n停用後對方無法登入，但自評表等紀錄都會保留，之後可以再啟用。`)) return;
    runAction(() => api(`/${a.id}/deactivate`, 'POST'), `已停用「${a.name}」`);
  },
  activate: (a) => runAction(() => api(`/${a.id}/activate`, 'POST'), `已重新啟用「${a.name}」`),
  delete: (a) => {
    if (!confirm(`確定要「永久刪除」${a.name} 嗎？\n這個動作無法復原。`)) return;
    runAction(() => api(`/${a.id}`, 'DELETE'), `已永久刪除「${a.name}」`);
  },
};

async function runAction(fn, successText) {
  setStatus('處理中…');
  try {
    await fn();
    setStatus(successText);
    await load();
  } catch (err) {
    setStatus(err.message, true);
  }
}

function openEdit(account) {
  editingId = account?.id || null;
  $('editTitle').textContent = account ? `編輯帳號：${account.name}` : '新增帳號';
  $('fName').value = account?.name || '';
  $('fLoginCode').value = account?.login_code || '';
  $('fPartTime').checked = !!account?.is_part_time;
  $('fPassword').value = '';
  $('fPasswordField').style.display = account ? 'none' : '';
  $('editError').textContent = '';

  // 館別：總公司可以選；店經理固定是自己館別（後端也會強制）
  $('fBranchField').style.display = isHQ ? '' : 'none';
  $('fBranch').innerHTML = meta.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  $('fBranch').value = account?.branch_id ||
    $('branchFilter').value ||
    meta.branches.find((b) => b.code !== 'HQ')?.id ||
    meta.branches[0]?.id || '';

  // 職務：店經理只會拿到房務、客務；編輯自己時鎖住（後端也會擋）
  $('fRole').innerHTML = meta.roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  if (account) $('fRole').value = account.role_id;
  $('fRole').disabled = !!account?.is_self;
  $('fRoleHint').style.display = account?.is_self ? '' : 'none';

  $('editDialog').showModal();
  $('fName').focus();
}

async function saveEdit(event) {
  event.preventDefault();
  const body = {
    name: $('fName').value,
    login_code: $('fLoginCode').value,
    branch_id: $('fBranch').value,
    role_id: $('fRole').value,
    is_part_time: $('fPartTime').checked,
  };
  if (!editingId && $('fPassword').value) body.password = $('fPassword').value;

  $('editError').textContent = '儲存中…';
  try {
    const saved = editingId
      ? await api(`/${editingId}`, 'PUT', body)
      : await api('', 'POST', body);
    $('editDialog').close();
    setStatus(editingId ? `已更新「${saved.name}」` : `已新增「${saved.name}」`);

    // 改的是自己的姓名時，同步更新側邊選單底下顯示的名字
    if (saved.id === staff.id) {
      localStorage.setItem('staff', JSON.stringify({ ...staff, name: saved.name }));
    }
    await load();
  } catch (err) {
    $('editError').textContent = err.message;
  }
}

function openPassword(account) {
  pwTargetId = account.id;
  $('pwTitle').textContent = account.is_self ? '修改我的密碼' : `設定「${account.name}」的新密碼`;
  $('pwInput').value = '';
  $('pwInput').type = 'password';
  $('pwShow').checked = false;
  $('pwError').textContent = '';
  $('pwDialog').showModal();
  $('pwInput').focus();
}

async function savePassword(event) {
  event.preventDefault();
  const password = $('pwInput').value;
  if (!password.trim()) {
    $('pwError').textContent = '請輸入新密碼';
    return;
  }

  $('pwError').textContent = '儲存中…';
  try {
    const saved = await api(`/${pwTargetId}/password`, 'POST', { password });
    $('pwDialog').close();
    setStatus(`已設定「${saved.name}」的新密碼`);
    await load();
  } catch (err) {
    $('pwError').textContent = err.message;
  }
}
