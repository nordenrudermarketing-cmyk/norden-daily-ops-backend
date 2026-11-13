// 獎金基數（人事行政、總辦公室）——後端見 gas/Appraisal.gs 的 apiAppraisalBases_
// 每位同仁每個項目一格；留空＝用預設值。項目和預設基數在「評核項目設定」新增、修改

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const $ = (id) => document.getElementById(id);

let people = [];

if (!staff) {
  window.location.href = 'index.html';
} else if (!['hq_admin', 'office'].includes(window.accountLevelOf(staff))) {
  alert('獎金基數只有人事行政、總辦公室帳號可以設定');
  window.location.href = 'index.html';
} else {
  $('staffLine').textContent = staff.name;
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

async function load() {
  try {
    const res = await fetch(`${API}/api/appraisal/bases`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '讀取失敗');
    people = data;
  } catch (err) {
    $('list').innerHTML = '';
    setStatus(err.message, true);
    return;
  }
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
            <label class="base">${escapeHtml(i.name)}
              <input type="number" min="0" step="1" data-item="${i.id}" class="${i.custom ? 'custom' : ''}"
                value="${i.custom ? i.base : ''}" placeholder="預設 ${i.default_base}">
            </label>`).join('')}
          <button type="button" class="small-btn" data-save>儲存</button>
        </div>
      </div>`).join('')}`).join('');

  document.querySelectorAll('[data-save]').forEach((btn) => btn.addEventListener('click', () => save(btn.closest('.person'))));
}

async function save(box) {
  const person = people.find((p) => p.staff_id === box.dataset.id);
  const bases = {};
  box.querySelectorAll('input[data-item]').forEach((input) => {
    bases[input.dataset.item] = input.value === '' ? null : input.value;
  });
  setStatus('儲存中…');
  try {
    const res = await fetch(`${API}/api/appraisal/bases/${encodeURIComponent(person.staff_id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bases }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '儲存失敗');
  } catch (err) {
    setStatus(err.message, true);
    return;
  }
  setStatus(`已儲存 ${person.name} 的獎金基數`);
  load();
}
