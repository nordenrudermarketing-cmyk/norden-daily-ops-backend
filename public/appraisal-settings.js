// 評核項目設定（只有總辦公室）——後端見 gas/Appraisal.gs
// 評核類別、項目（誰來評、預設獎金基數、說明、接獎懲）、職務對應的類別

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const $ = (id) => document.getElementById(id);

let data = null;
let editing = null; // { groupId, item }

if (!staff) {
  window.location.href = 'index.html';
} else if (window.accountLevelOf(staff) !== 'office') {
  alert('評核項目設定只有總辦公室帳號可以使用');
  window.location.href = 'index.html';
} else {
  $('staffLine').textContent = staff.name;
  $('addGroupBtn').addEventListener('click', addGroup);
  $('itemForm').addEventListener('submit', saveItem);
  $('iSource').addEventListener('change', syncSourceHint);
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
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
  const res = await fetch(`${API}/api/appraisal${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || '操作失敗，請稍後再試');
  return result;
}

async function load() {
  try {
    data = await api('/settings');
  } catch (err) {
    $('groups').innerHTML = '';
    setStatus(err.message, true);
    return;
  }
  $('iSource').innerHTML = data.sources.map((s) => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join('');
  render();
}

const sourceLabel = (key) => data.sources.find((s) => s.key === key)?.label || key;

function render() {
  if (!data.groups.length) {
    $('groups').innerHTML = '<p class="empty-state">還沒有評核類別。<br>請在試算表選單按「路得系統 → 匯入評核項目預設值」，或在下面新增。</p>';
  } else {
    $('groups').innerHTML = data.groups.map((g) => {
      const roles = data.roles.filter((r) => r.appraisal_group_id === g.id).map((r) => r.name);
      const items = g.items.map((i) => `
        <div class="item-row ${i.is_active ? '' : 'inactive'}">
          <div>
            <p class="item-name">${escapeHtml(i.name)}${i.is_active ? '' : '（停用）'}</p>
            <p class="item-meta">${escapeHtml(sourceLabel(i.source))}・預設 $${i.default_base}／分${i.takes_reward ? '・接獎懲' : ''}</p>
          </div>
          <button type="button" class="small-btn" data-edit="${i.id}" data-group="${g.id}">編輯</button>
        </div>`).join('');
      return `
        <div class="group ${g.is_active ? '' : 'inactive'}">
          <div class="group-head">
            <h3>${escapeHtml(g.name)} ${g.is_active ? '' : '<small>（停用）</small>'}</h3>
            <button type="button" class="small-btn" data-add="${g.id}">新增項目</button>
            <button type="button" class="small-btn" data-rename="${g.id}">改名</button>
            <button type="button" class="small-btn" data-toggle="${g.id}">${g.is_active ? '停用' : '啟用'}</button>
          </div>
          ${items || '<p class="item-meta" style="margin-top:8px;">還沒有項目</p>'}
          <p class="roles-for">使用的職務：${roles.length ? escapeHtml(roles.join('、')) : '（沒有）'}</p>
        </div>`;
    }).join('');
  }

  $('roles').innerHTML = data.roles.map((r) => `
    <div class="role-row">
      <span class="name">${escapeHtml(r.name)}</span>
      <span class="meta">在職 ${r.staff_count} 人</span>
      <select data-role="${r.id}">
        <option value="">不評核</option>
        ${data.groups.map((g) => `<option value="${g.id}" ${g.id === r.appraisal_group_id ? 'selected' : ''}>${escapeHtml(g.name)}${g.is_active ? '' : '（停用）'}</option>`).join('')}
      </select>
    </div>`).join('');

  bind();
}

function bind() {
  document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const g = data.groups.find((x) => x.id === b.dataset.group);
    openItem(g, g.items.find((i) => i.id === b.dataset.edit));
  }));
  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    openItem(data.groups.find((x) => x.id === b.dataset.add), null);
  }));
  document.querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', () => {
    const g = data.groups.find((x) => x.id === b.dataset.rename);
    const name = prompt('評核類別的新名稱', g.name);
    if (name && name.trim() !== g.name) run(() => api(`/groups/${g.id}`, 'PUT', { name }), '已改名');
  }));
  document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    const g = data.groups.find((x) => x.id === b.dataset.toggle);
    run(() => api(`/groups/${g.id}`, 'PUT', { is_active: !g.is_active }), g.is_active ? `已停用「${g.name}」` : `已啟用「${g.name}」`);
  }));
  document.querySelectorAll('[data-role]').forEach((sel) => sel.addEventListener('change', () => {
    const role = data.roles.find((r) => r.id === sel.dataset.role);
    run(() => api(`/roles/${role.id}`, 'PUT', { appraisal_group_id: sel.value }), `已更新「${role.name}」的評核類別`);
  }));
}

function syncSourceHint() {
  $('iSourceHint').textContent = data.sources.find((s) => s.key === $('iSource').value)?.hint || '';
}

function openItem(group, item) {
  editing = { groupId: group.id, item };
  $('itemTitle').textContent = item ? `編輯項目：${group.name}／${item.name}` : `新增項目：${group.name}`;
  $('iName').value = item?.name || '';
  $('iBase').value = item ? item.default_base : 30;
  $('iSource').value = item?.source || 'main';
  $('iDesc').value = item?.description || '';
  $('iGrade').value = item?.grade_desc || '';
  $('iReward').checked = !!item?.takes_reward;
  $('iActive').checked = item ? item.is_active : true;
  $('itemError').textContent = '';
  syncSourceHint();
  $('itemDialog').showModal();
}

async function saveItem(event) {
  event.preventDefault();
  const body = {
    name: $('iName').value,
    default_base: $('iBase').value,
    source: $('iSource').value,
    description: $('iDesc').value,
    grade_desc: $('iGrade').value,
    takes_reward: $('iReward').checked,
    is_active: $('iActive').checked,
  };
  try {
    if (editing.item) await api(`/items/${editing.item.id}`, 'PUT', body);
    else await api('/items', 'POST', Object.assign({ group_id: editing.groupId }, body));
  } catch (err) {
    $('itemError').textContent = err.message;
    return;
  }
  $('itemDialog').close();
  setStatus('已儲存');
  load();
}

async function addGroup() {
  const name = $('newGroup').value.trim();
  if (!name) { setStatus('請填寫評核類別名稱', true); return; }
  await run(() => api('/groups', 'POST', { name }), `已新增「${name}」`);
  $('newGroup').value = '';
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
