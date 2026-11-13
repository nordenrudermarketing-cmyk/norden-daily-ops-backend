// 例行任務設定（人事行政、總辦公室）：新增、修改、停用主管的週／月／年例行任務
// 欄位規則在後端 gas/Routine.gs 的 rtCleanItem_；不提供刪除，停用就好（回報紀錄才不會沒有對應的任務）

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const level = staff ? window.accountLevelOf(staff) : null;

const $ = (id) => document.getElementById(id);
const WEEKDAYS = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];

let items = [];
let branches = [];
let period = 'week';
let editing = null; // 正在編輯的任務；null＝新增

if (!staff) {
  window.location.href = 'index.html';
} else if (level !== 'office' && level !== 'hq_admin') {
  window.location.href = 'self-eval.html';
} else {
  init();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API}/api/routine-tasks${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || '操作失敗，請稍後再試');
  return result;
}

function setStatus(text, isError = false) {
  $('statusLine').textContent = text;
  $('statusLine').className = 'status-line' + (isError ? ' err' : '');
}

function init() {
  $('tabs').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      period = btn.dataset.period;
      render();
    });
  });
  $('showInactive').addEventListener('change', render);
  $('addBtn').addEventListener('click', () => openEdit(null));
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
  $('editForm').addEventListener('submit', save);
  $('fPeriod').addEventListener('change', syncPeriodFields);
  $('fRemindMonth').innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1} 月</option>`).join('');
  load();
}

async function load() {
  try {
    const result = await api('/items');
    items = result.items;
    branches = result.branches;
    render();
  } catch (err) {
    $('list').innerHTML = '';
    setStatus(err.message, true);
  }
}

function branchNames(item) {
  const ids = String(item.branch_ids || '').split(',').filter(Boolean);
  if (ids.length === 0) return '所有部門';
  return ids.map((id) => branches.find((b) => b.id === id)?.name || '（已停用的部門）').join('、');
}

function scheduleText(item) {
  if (item.period === 'week') return `${WEEKDAYS[item.due_weekday || 7]}前${item.times > 1 ? `・每週 ${item.times} 次` : ''}`;
  if (item.period === 'month') {
    const due = (item.due_day || 31) >= 31 ? '月底' : `${item.due_day} 號`;
    const steps = String(item.steps || '').split('\n').filter(Boolean).length;
    return `${item.start_day || 1} 號出現・${due}前${item.times > 1 ? `・每月 ${item.times} 次` : ''}${steps ? `・${steps} 個時間點` : ''}`;
  }
  return `${item.remind_month} 月提醒${item.due_hint ? `・${item.due_hint}` : ''}`;
}

function render() {
  $('tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.period === period));
  const showInactive = $('showInactive').checked;
  const list = items.filter((it) => it.period === period && (showInactive || it.is_active !== false));
  if (list.length === 0) {
    $('list').innerHTML = '<p class="empty-state">這個週期還沒有任務</p>';
    return;
  }
  let lastCat = null;
  $('list').innerHTML = list.map((it) => {
    const head = it.category !== lastCat ? `<p class="cat-title">${escapeHtml(it.category)}</p>` : '';
    lastCat = it.category;
    const active = it.is_active !== false;
    return `${head}<div class="item-row ${active ? '' : 'inactive'}" data-id="${it.id}">
      <div>
        <p class="item-name">${escapeHtml(it.title)}${active ? '' : '（已停用）'}</p>
        <p class="item-meta">${escapeHtml(scheduleText(it))}・${escapeHtml(branchNames(it))}${it.report_hint ? '・回報必填說明' : ''}</p>
      </div>
      <div class="item-actions">
        <button type="button" data-act="edit">編輯</button>
        <button type="button" data-act="toggle">${active ? '停用' : '重新啟用'}</button>
      </div>
    </div>`;
  }).join('');

  $('list').querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = items.find((it) => it.id === btn.closest('.item-row').dataset.id);
      if (btn.dataset.act === 'edit') openEdit(item);
      else toggle(item);
    });
  });
}

function syncPeriodFields() {
  const p = $('fPeriod').value;
  document.querySelectorAll('[data-for]').forEach((el) => {
    el.style.display = el.dataset.for === p ? '' : 'none';
  });
}

function openEdit(item) {
  editing = item;
  $('editTitle').textContent = item ? `編輯：${item.title}` : '新增任務';
  $('fPeriod').value = item?.period || period;
  $('fCategory').value = item?.category || '';
  $('fTitle').value = item?.title || '';
  $('fDescription').value = item?.description || '';
  $('fTimesWeek').value = item?.period === 'week' ? item.times : 1;
  $('fWeekday').value = item?.due_weekday || 7;
  $('fStartDay').value = item?.start_day || 1;
  $('fDueDay').value = item?.due_day || 31;
  $('fTimesMonth').value = item?.period === 'month' ? item.times : 1;
  $('fSteps').value = item?.steps || '';
  $('fRemindMonth').value = item?.remind_month || 1;
  $('fDueHint').value = item?.due_hint || '';
  $('fReportHint').value = item?.report_hint || '';
  $('fActive').checked = item ? item.is_active !== false : true;
  const selected = new Set(String(item?.branch_ids || '').split(',').filter(Boolean));
  $('fBranches').innerHTML = branches.map((b) =>
    `<label><input type="checkbox" value="${b.id}" ${selected.has(b.id) ? 'checked' : ''}> ${escapeHtml(b.name)}</label>`).join('');
  $('categoryList').innerHTML = [...new Set(items.map((it) => it.category).filter(Boolean))]
    .map((c) => `<option value="${escapeHtml(c)}">`).join('');
  $('editError').textContent = '';
  syncPeriodFields();
  $('editDialog').showModal();
  $('fTitle').focus();
}

function formBody() {
  const p = $('fPeriod').value;
  return {
    period: p,
    category: $('fCategory').value,
    title: $('fTitle').value,
    description: $('fDescription').value,
    report_hint: $('fReportHint').value,
    branch_ids: [...$('fBranches').querySelectorAll('input:checked')].map((c) => c.value),
    times: p === 'week' ? $('fTimesWeek').value : $('fTimesMonth').value,
    due_weekday: $('fWeekday').value,
    start_day: $('fStartDay').value,
    due_day: $('fDueDay').value,
    steps: $('fSteps').value,
    remind_month: $('fRemindMonth').value,
    due_hint: $('fDueHint').value,
    is_active: $('fActive').checked,
  };
}

async function save(event) {
  event.preventDefault();
  $('editError').textContent = '儲存中…';
  try {
    const saved = editing
      ? await api(`/items/${encodeURIComponent(editing.id)}`, 'PUT', formBody())
      : await api('/items', 'POST', formBody());
    $('editDialog').close();
    period = saved.period;
    setStatus(editing ? `已更新「${saved.title}」` : `已新增「${saved.title}」`);
    await load();
  } catch (err) {
    $('editError').textContent = err.message;
  }
}

// 停用／重新啟用：送出原本的內容，只改 is_active
async function toggle(item) {
  const active = item.is_active !== false;
  if (active && !confirm(`確定要停用「${item.title}」嗎？\n停用後主管就不會再看到這個任務，以前的回報紀錄會保留。`)) return;
  try {
    await api(`/items/${encodeURIComponent(item.id)}`, 'PUT', { ...item, branch_ids: String(item.branch_ids || ''), is_active: !active });
    setStatus(active ? `已停用「${item.title}」` : `已重新啟用「${item.title}」`);
    await load();
  } catch (err) {
    setStatus(err.message, true);
  }
}
