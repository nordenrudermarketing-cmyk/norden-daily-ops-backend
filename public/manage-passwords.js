// 帳號管理（檔名沿用 manage-passwords，原本連到「密碼管理」的連結才不會壞掉）
// 依帳號層級（gas/Levels.gs）：只能建立、管理比自己低的層級，總辦公室可以管同級
//   總辦公室：全部帳號；總公司行政：經理、現場人員；經理：自己管轄的現場人員
//   總公司行政、總辦公室可以設定經理／總辦公室的「管轄人員」
// 權限由後端 /api/accounts 依資料庫裡的真實帳號層級與管轄判斷，這裡只負責畫面

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const level = staff ? window.accountLevelOf(staff) : null;
const isManager = level === 'manager';

const $ = (id) => document.getElementById(id);

let meta = { branches: [], roles: [] };
let accounts = [];
let editingId = null; // null 代表新增
let pwTargetId = null;
let supTarget = null;   // 正在設定管轄人員的主管
let supSelected = null; // Set：勾選中的同仁 id

if (!staff) {
  window.location.href = 'index.html';
} else if (level === 'field') {
  alert('帳號管理只有經理以上的帳號層級可以使用');
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
  $('supForm').addEventListener('submit', saveSupervision);
  $('supSearch').addEventListener('input', renderSupList);

  try {
    meta = await api('/meta');
  } catch (err) {
    setStatus(err.message, true);
    return;
  }

  const SCOPE_TEXT = {
    office: '你可以管理：全部帳號（含其他總辦公室）；經理、總辦公室的帳號可以設定「管轄人員」',
    hq_admin: '你可以管理：經理、現場人員的帳號；經理、總辦公室的帳號可以設定「管轄人員」',
    manager: '你可以管理：你管轄的現場人員帳號（自己的帳號可以改姓名、密碼）。管轄人員由總公司行政或總辦公室設定',
  };
  $('scopeLine').textContent = `你的帳號層級：${meta.actor.level_label}。${SCOPE_TEXT[meta.actor.level] || ''}`;
  // 部門篩選：經理的管轄人員只在一個部門時不用顯示
  if (!isManager || meta.branches.length > 1) {
    $('branchFilter').style.display = '';
    $('branchFilter').innerHTML = '<option value="">全部部門</option>' +
      meta.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
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
          <span class="badge level-${a.account_level}">${escapeHtml(a.level_label)}</span>
          <span class="badge ${a.has_password ? 'ok' : 'warn'}">${a.has_password ? '已設定密碼' : '尚未設定密碼'}</span>
        </p>
        ${supervisionLine(a)}
      </div>
      <div class="acct-actions">
        ${a.can_set_supervision && a.is_active ? '<button data-act="supervise">管轄人員</button>' : ''}
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

// 「面談主管：A、B」或「未指定面談主管」（只有要填自評的層級才需要）；能當主管的帳號再加「管轄 N 人」
function supervisionLine(a) {
  if (!a.is_active) return '';
  const parts = [];
  if (a.fills_self_eval) {
    if (a.supervisor_names?.length) parts.push(`面談主管：${escapeHtml(a.supervisor_names.join('、'))}`);
    else parts.push('<span class="badge warn" style="margin-left:0;">未指定面談主管</span>');
  } else {
    parts.push('不需要自評');
  }
  if (a.can_supervise) parts.push(`管轄 ${a.supervisee_count} 人`);
  return `<p class="acct-sup">${parts.join('　')}</p>`;
}

const ACTIONS = {
  supervise: (a) => openSupervision(a),
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

  // 下拉選單只列出可以選的；編輯時如果原本的值不在清單裡（例如部門已停用），也保留它
  const withCurrent = (list, current) =>
    current && current.id && !list.some((x) => x.id === current.id) ? [...list, current] : list;
  const isSelf = !!account?.is_self;

  // 部門：經理只能選自己的部門和管轄人員所在的部門（只有一個時就不顯示，後端也會檢查）
  const branches = withCurrent(meta.branches, account && { id: account.branch_id, name: account.branch_name });
  $('fBranchField').style.display = !isManager || branches.length > 1 ? '' : 'none';
  $('fBranch').innerHTML = branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  $('fBranch').value = account?.branch_id ||
    $('branchFilter').value ||
    meta.branches.find((b) => b.code !== 'HQ')?.id ||
    meta.branches[0]?.id || '';

  // 職務：只決定自評題目
  const roles = withCurrent(meta.roles, account && { id: account.role_id, name: account.role_name });
  $('fRole').innerHTML = roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  if (account) $('fRole').value = account.role_id;

  // 帳號層級：只能設成比自己低的層級（總辦公室可以設同級）
  const levels = withCurrent(meta.levels.map((l) => ({ id: l.key, name: l.label })),
    account && { id: account.account_level, name: account.level_label });
  $('fLevel').innerHTML = levels.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
  $('fLevel').value = account?.account_level || 'field';

  // 自己的帳號：部門、職務、層級都不能自己改（後端也會擋）
  ['fBranch', 'fRole', 'fLevel'].forEach((id) => { $(id).disabled = isSelf; });
  $('fRoleHint').style.display = isSelf ? '' : 'none';

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
    account_level: $('fLevel').value,
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

// ---------- 管轄人員（總公司行政、總辦公室） ----------

async function openSupervision(account) {
  supTarget = account;
  supSelected = null;
  $('supTitle').textContent = `「${account.name}」的管轄人員`;
  $('supSearch').value = '';
  $('supError').textContent = '';
  $('supList').innerHTML = '<p class="empty-state">載入中…</p>';
  $('supCount').textContent = '';
  $('supDialog').showModal();

  try {
    const res = await fetch(`${API}/api/supervisions/${encodeURIComponent(account.id)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '載入失敗');
    // 停用中的同仁也保留在名單裡（畫面上不列出），儲存時才不會把他們拿掉
    supSelected = new Set(data.staff_ids || []);
    renderSupList();
  } catch (err) {
    $('supList').innerHTML = '';
    $('supError').textContent = err.message;
  }
}

// 可以選的人：要填自評的在職同仁（現場人員、經理，不含主管自己），依部門分組；每組可以「全選本部門」
function renderSupList() {
  if (!supSelected) return;
  const keyword = $('supSearch').value.trim().toLowerCase();
  const people = accounts.filter((a) => a.is_active && a.fills_self_eval && a.id !== supTarget.id && (!keyword ||
    a.name.toLowerCase().includes(keyword) || (a.login_code || '').toLowerCase().includes(keyword)));

  const groups = new Map();
  people.forEach((a) => {
    const key = a.branch_name || '（沒有部門）';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  });

  if (groups.size === 0) {
    $('supList').innerHTML = '<p class="empty-state">沒有符合條件的同仁</p>';
  } else {
    $('supList').innerHTML = [...groups.entries()]
      .sort((x, y) => x[0].localeCompare(y[0], 'zh-Hant'))
      .map(([branch, list], i) => {
        const allOn = list.every((a) => supSelected.has(a.id));
        return `
          <label class="sup-group-title"><input type="checkbox" data-group="${i}" ${allOn ? 'checked' : ''}> ${escapeHtml(branch)}（全選本部門 ${list.length} 人）</label>
          ${list.map((a) => `
            <label class="sup-item"><input type="checkbox" data-id="${a.id}" data-in-group="${i}" ${supSelected.has(a.id) ? 'checked' : ''}>
              ${escapeHtml(a.name)} <small>${escapeHtml(a.role_name || '')}・${escapeHtml(a.login_code || '')}</small></label>`).join('')}`;
      }).join('');
  }

  $('supList').querySelectorAll('input[data-id]').forEach((box) => {
    box.addEventListener('change', () => {
      if (box.checked) supSelected.add(box.dataset.id);
      else supSelected.delete(box.dataset.id);
      renderSupList();
    });
  });
  $('supList').querySelectorAll('input[data-group]').forEach((box) => {
    box.addEventListener('change', () => {
      $('supList').querySelectorAll(`input[data-in-group="${box.dataset.group}"]`).forEach((item) => {
        if (box.checked) supSelected.add(item.dataset.id);
        else supSelected.delete(item.dataset.id);
      });
      renderSupList();
    });
  });

  const activeIds = new Set(accounts.filter((a) => a.is_active).map((a) => a.id));
  const count = [...supSelected].filter((id) => activeIds.has(id)).length;
  $('supCount').textContent = `已選 ${count} 位在職同仁`;
}

async function saveSupervision(event) {
  event.preventDefault();
  if (!supSelected) return;
  $('supError').textContent = '儲存中…';
  try {
    const res = await fetch(`${API}/api/supervisions/${encodeURIComponent(supTarget.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_ids: [...supSelected] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '儲存失敗');
    $('supDialog').close();
    setStatus(`已更新「${supTarget.name}」的管轄人員（新增 ${data.added} 人、移除 ${data.removed} 人）`);
    await load();
  } catch (err) {
    $('supError').textContent = err.message;
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
