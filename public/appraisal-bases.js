// 獎金基數（人事行政、總辦公室）——後端見 gas/Appraisal.gs 的 apiAppraisalBases_
// 每位同仁每個項目一格；留空＝用預設值。共通的項目和預設基數在「評核項目設定」新增、修改；
// 某位同仁多一個項目時，在這裡「新增個人項目」（只有他會被評這一項，獎金照這一項的基數算）

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const $ = (id) => document.getElementById(id);

let people = [];
let sources = [];
let editing = null; // { person, item }（item 是 null＝新增）

if (!staff) {
  window.location.href = 'index.html';
} else if (!['hq_admin', 'office'].includes(window.accountLevelOf(staff))) {
  alert('獎金基數只有人事行政、總辦公室帳號可以設定');
  window.location.href = 'index.html';
} else {
  $('staffLine').textContent = staff.name;
  $('itemForm').addEventListener('submit', saveItem);
  $('pCancel').addEventListener('click', () => $('itemDialog').close());
  $('pRemove').addEventListener('click', removeItem);
  $('pSource').addEventListener('change', syncSourceHint);
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
    const data = await api('/bases');
    people = data.people;
    sources = data.sources;
  } catch (err) {
    $('list').innerHTML = '';
    setStatus(err.message, true);
    return;
  }
  // 個人項目「誰來評」跟一般項目一樣（同事內評只對主管有效：由他管轄部門的現場正職評）
  $('pSource').innerHTML = sources.map((s) => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join('');
  render();
}

function render() {
  if (!people.length) {
    $('list').innerHTML = '<p class="empty-state">目前沒有要評核的同仁。請先到「評核項目設定」幫職務指定評核類別。</p>';
    return;
  }
  const byBranch = {};
  people.forEach((p) => { (byBranch[p.branch_name] = byBranch[p.branch_name] || []).push(p); });
  $('list').innerHTML = Object.keys(byBranch).map((branch) => `
    <h2 class="sec-title">${escapeHtml(branch)}</h2>
    ${byBranch[branch].map((p) => `
      <div class="person" data-id="${p.staff_id}">
        <div class="person-head">
          <span class="name">${escapeHtml(p.name)}</span>
          <span class="meta">${escapeHtml(p.role_name)}${p.is_junior ? '・兼職／實習生' : ''}</span>
        </div>
        <div class="bases">
          ${p.items.map((i) => `
            <label class="base">
              ${i.personal
                ? `<span class="personal">${escapeHtml(i.name)}<span class="tag">個人</span><button type="button" class="edit-link" data-edit="${i.id}">編輯</button></span>`
                : escapeHtml(i.name)}
              <input type="number" min="0" step="1" data-item="${i.id}" class="${i.custom ? 'custom' : ''}"
                value="${i.custom ? i.base : ''}" placeholder="預設 ${i.default_base}">
            </label>`).join('')}
          <button type="button" class="small-btn" data-save>儲存</button>
          <button type="button" class="small-btn ghost" data-add>＋ 新增個人項目</button>
        </div>
      </div>`).join('')}`).join('');

  document.querySelectorAll('[data-save]').forEach((btn) => btn.addEventListener('click', () => save(btn.closest('.person'))));
  document.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
    openItem(people.find((p) => p.staff_id === btn.closest('.person').dataset.id), null);
  }));
  document.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.preventDefault(); // 按鈕在 label 裡，不要讓它去點旁邊的輸入框
    const person = people.find((p) => p.staff_id === btn.closest('.person').dataset.id);
    openItem(person, person.items.find((i) => i.id === btn.dataset.edit));
  }));
}

async function save(box) {
  const person = people.find((p) => p.staff_id === box.dataset.id);
  const bases = {};
  box.querySelectorAll('input[data-item]').forEach((input) => {
    bases[input.dataset.item] = input.value === '' ? null : input.value;
  });
  setStatus('儲存中…');
  try {
    await api(`/bases/${encodeURIComponent(person.staff_id)}`, 'PUT', { bases });
  } catch (err) {
    setStatus(err.message, true);
    return;
  }
  setStatus(`已儲存 ${person.name} 的獎金基數`);
  load();
}

// ---------- 個人項目 ----------

function syncSourceHint() {
  $('pSourceHint').textContent = sources.find((s) => s.key === $('pSource').value)?.hint || '';
}

function openItem(person, item) {
  editing = { person, item };
  $('itemTitle').textContent = item ? `編輯 ${person.name} 的個人項目` : `幫 ${person.name} 新增個人項目`;
  $('pName').value = item?.name || '';
  $('pSource').value = item?.source || 'main';
  $('pBase').value = item ? item.default_base : 30;
  $('pDesc').value = item?.description || '';
  $('pRemove').style.display = item ? '' : 'none';
  $('pRemove').dataset.armed = '';
  $('pRemove').textContent = '移除這個項目';
  $('itemError').textContent = '';
  syncSourceHint();
  $('itemDialog').showModal();
  $('pName').focus();
}

async function saveItem(event) {
  event.preventDefault();
  const body = {
    name: $('pName').value,
    source: $('pSource').value,
    default_base: $('pBase').value,
    description: $('pDesc').value,
  };
  $('itemError').textContent = '儲存中…';
  try {
    if (editing.item) await api(`/personal-items/${editing.item.id}`, 'PUT', body);
    else await api('/personal-items', 'POST', Object.assign({ staff_id: editing.person.staff_id }, body));
  } catch (err) {
    $('itemError').textContent = err.message;
    return;
  }
  $('itemDialog').close();
  setStatus(`已儲存 ${editing.person.name} 的個人項目「${body.name.trim()}」`);
  load();
}

// 移除要按兩次（第一次變成「確定移除？」）：對話框開著時，備援的確認視窗會被蓋在後面，所以不用 confirm()
async function removeItem() {
  const { person, item } = editing;
  const btn = $('pRemove');
  if (btn.dataset.armed !== '1') {
    btn.dataset.armed = '1';
    btn.textContent = '確定移除？再按一次';
    $('itemError').textContent = '移除後不會再評這一項；已經評過、已經定案的資料會留著。';
    return;
  }
  $('itemError').textContent = '處理中…';
  try {
    await api(`/personal-items/${item.id}`, 'PUT', { is_active: false });
  } catch (err) {
    $('itemError').textContent = err.message;
    return;
  }
  $('itemDialog').close();
  setStatus(`已移除 ${person.name} 的「${item.name}」`);
  load();
}
