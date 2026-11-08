// 例行任務（主管）：我管轄的部門現在要做的週／月／年任務，在這裡回報完成或未能完成
// 規則都在後端 gas/Routine.gs；這裡只負責畫面。總公司層級會被帶到「執行狀況」頁

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const level = staff ? window.accountLevelOf(staff) : null;

const $ = (id) => document.getElementById(id);

let data = null;          // /api/routine-tasks/mine 的結果
let branchFilter = '';    // 空白＝全部部門
let reporting = null;     // 正在回報的任務 { inst, kind }
// 「只看待辦」預設打開；這台裝置記住上次的選擇（瀏覽器不讓存也沒關係）
const PENDING_ONLY_KEY = 'routinePendingOnly';
let pendingOnly = true;
try { pendingOnly = localStorage.getItem(PENDING_ONLY_KEY) !== 'false'; } catch (e) { /* 用預設值 */ }

if (!staff) {
  window.location.href = 'index.html';
} else if (level === 'office' || level === 'hq_admin') {
  window.location.href = 'routine-tasks-overview.html';
} else if (level !== 'manager') {
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

function init() {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
  $('reportForm').addEventListener('submit', submitReport);
  $('pendingOnly').checked = pendingOnly;
  $('pendingOnly').addEventListener('change', () => {
    pendingOnly = $('pendingOnly').checked;
    try { localStorage.setItem(PENDING_ONLY_KEY, String(pendingOnly)); } catch (e) { /* 存不了就算了 */ }
    if (data) render();
  });
  load();
}

async function load() {
  try {
    data = await api('/mine');
  } catch (err) {
    $('list').innerHTML = '';
    $('statusLine').textContent = err.message;
    return;
  }
  $('todayLine').textContent = `今天 ${data.today_label}`;
  renderChips();
  render();
}

// 管轄多個部門時，可以只看某一個部門
function renderChips() {
  if (data.branches.length < 2) {
    $('branchChips').style.display = 'none';
    return;
  }
  $('branchChips').style.display = '';
  const options = [{ id: '', name: '全部' }, ...data.branches];
  $('branchChips').innerHTML = options.map((b) =>
    `<button type="button" data-branch="${b.id}" class="${b.id === branchFilter ? 'on' : ''}">${escapeHtml(b.name)}</button>`).join('');
  $('branchChips').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      branchFilter = btn.dataset.branch;
      renderChips();
      render();
    });
  });
}

const STATUS_ORDER = { overdue: 0, backlog: 0, open: 1, upcoming: 2, missed: 3, done: 4 };

function render() {
  if (data.branches.length === 0) {
    $('list').innerHTML = '<p class="empty-state">你還沒有管轄的部門。<br>請總公司在「帳號管理」→「管轄設定」勾選你負責的部門。</p>';
    return;
  }
  const inBranch = data.instances.filter((i) => !branchFilter || i.branch_id === branchFilter);
  // 「只看待辦」：已完成、未能完成的先收起來
  const closedCount = inBranch.filter((i) => i.status === 'done' || i.status === 'missed').length;
  const list = pendingOnly ? inBranch.filter((i) => i.status !== 'done' && i.status !== 'missed') : inBranch;
  $('pendingNote').textContent = pendingOnly && closedCount ? `（已完成 ${closedCount} 項先收起來）` : '';
  const multi = data.branches.length > 1 && !branchFilter;
  const sort = (a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || String(a.due || a.start).localeCompare(String(b.due || b.start));

  const behind = list.filter((i) => i.status === 'overdue' || i.status === 'backlog').sort(sort);
  const ofPeriod = (period) => list.filter((i) => i.period === period && i.status !== 'overdue' && i.status !== 'backlog' && i.status !== 'upcoming').sort(sort);
  const later = list.filter((i) => i.status === 'upcoming').sort(sort);

  const section = (title, hint, items, cls = '') => items.length === 0 ? '' : `
    <h2 class="sec-title ${cls}">${title}<small>${countText(items)}</small></h2>
    ${hint ? `<p class="sec-hint">${hint}</p>` : ''}
    ${items.map((i) => card(i, multi)).join('')}`;

  const html = [
    section('要補回報', '已經過了期限（或往年沒做完）。補做完請按完成並寫逾期原因；做不到請按「未能完成」寫原因。', behind, 'warn'),
    section('本週', '', ofPeriod('week')),
    section('本月', '', ofPeriod('month')),
    section('今年', '年度任務沒有硬性期限，做完再回報；沒做完會一直留著。', ofPeriod('year')),
    later.length ? `<details class="later"><summary>本月稍後開始（${later.length}）</summary>${later.map((i) => card(i, multi)).join('')}</details>` : '',
  ].join('');
  $('list').innerHTML = html || `<p class="empty-state">${closedCount ? '目前的例行任務都完成了 🎉' : '目前沒有要做的例行任務'}</p>`;

  $('list').querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inst = list[Number(btn.closest('.task').dataset.idx)];
      if (btn.dataset.act === 'undo') undo(btn.dataset.report);
      else openReport(inst, btn.dataset.act);
    });
  });
  // card() 用 list 的索引找回任務
  $('list').querySelectorAll('.task').forEach((el) => {
    el.dataset.idx = list.findIndex((i) => keyOf(i) === el.dataset.key);
  });
}

function keyOf(i) {
  return `${i.item_id}|${i.branch_id}|${i.period_key}`;
}

function countText(items) {
  const open = items.filter((i) => i.status !== 'done' && i.status !== 'missed').length;
  return open === items.length ? `${items.length} 項` : `${open} 項待完成／共 ${items.length} 項`;
}

function statusBadge(i) {
  if (i.status === 'done') return '<span class="st done">✓ 完成</span>';
  if (i.status === 'missed') return '<span class="st muted">未能完成</span>';
  if (i.status === 'overdue') return '<span class="st warn">逾期</span>';
  if (i.status === 'backlog') return '<span class="st warn">往年積壓</span>';
  if (i.status === 'upcoming') return `<span class="st muted">${i.start.slice(5).replace('-', '/')} 開始</span>`;
  return i.times > 1 ? `<span class="st muted">${i.done_count}/${i.times}</span>` : '';
}

function card(i, multi) {
  const closed = i.status === 'done' || i.status === 'missed';
  const warn = i.status === 'overdue' || i.status === 'backlog';
  const periodNote = (i.status === 'overdue' || i.status === 'backlog') ? `（${escapeHtml(i.period_label)}）` : '';
  const steps = i.steps.length ? `<ul class="steps">${i.steps.map((s) =>
    `<li class="${s.current ? 'current' : ''} ${s.past ? 'past' : ''}"><span class="day">${s.day} 號</span><span>${s.current ? '👉 ' : ''}${escapeHtml(s.text)}</span></li>`).join('')}</ul>` : '';
  const how = i.description ? `<details class="how"><summary>怎麼做</summary><p>${escapeHtml(i.description)}</p></details>` : '';
  const reports = i.reports.length ? `<div class="reports">${i.reports.map(reportLine).join('')}</div>` : '';

  let actions = '';
  if (!closed && i.status !== 'upcoming') {
    const next = i.times > 1 ? `完成 (${i.done_count + 1}/${i.times})` : '完成';
    // 一週要做好幾次的任務，同一天只能完成一次（後端也會擋）
    const done = i.done_today
      ? '<button class="primary" disabled style="opacity:0.45;cursor:default;">今天已完成，下一次請改天</button>'
      : `<button class="primary" data-act="done">${next}</button>`;
    actions = `<div class="action-row">
      ${done}
      <button class="secondary" data-act="missed">未能完成</button>
    </div>`;
  }

  return `
    <div class="task ${warn ? 'warn' : ''} ${closed ? 'closed' : ''}" data-key="${keyOf(i)}">
      <div class="task-head">
        <span class="task-cat">${escapeHtml(i.category)}${multi ? `・${escapeHtml(i.branch_name)}` : ''}</span>
        ${statusBadge(i)}
      </div>
      <p class="task-title">${escapeHtml(i.title)}</p>
      <p class="task-due ${i.late && !closed ? 'late' : ''}">${escapeHtml(i.due_label)}${periodNote}</p>
      ${steps}
      ${how}
      ${reports}
      ${actions}
    </div>`;
}

function reportLine(r) {
  const mine = r.staff_id === staff.id;
  // 24 小時內可以撤回自己的回報（後端也會檢查）
  const canUndo = mine && Date.now() - new Date(r.created_at).getTime() < 24 * 3600 * 1000;
  const what = r.kind === 'missed' ? '回報未能完成' : '完成';
  return `<p class="report">
    <span class="who">${escapeHtml(r.staff_name)}</span> ${escapeHtml(r.at_label)} ${what}${r.note ? `：${escapeHtml(r.note)}` : ''}
    ${r.late_reason ? `<br><span class="late">逾期原因：${escapeHtml(r.late_reason)}</span>` : ''}
    ${canUndo ? `<button type="button" data-act="undo" data-report="${r.id}">撤回</button>` : ''}
  </p>`;
}

function openReport(inst, kind) {
  reporting = { inst, kind };
  const isMissed = kind === 'missed';
  $('rTitle').textContent = isMissed ? '回報未能完成' : (inst.times > 1 ? `完成 (${inst.done_count + 1}/${inst.times})` : '回報完成');
  $('rSub').textContent = `${inst.title}・${inst.branch_name}・${inst.period_label}`;
  $('rLateField').style.display = !isMissed && inst.late ? '' : 'none';
  $('rLate').value = '';
  $('rNote').value = '';
  if (isMissed) {
    $('rNoteLabel').textContent = '未能完成的原因（必填）';
    $('rNote').placeholder = '例如：本週人力不足，下週補做';
  } else if (inst.report_hint) {
    $('rNoteLabel').textContent = `說明（必填）：${inst.report_hint}`;
    $('rNote').placeholder = '';
  } else {
    $('rNoteLabel').textContent = '說明（選填）';
    $('rNote').placeholder = '簡單寫下執行結果';
  }
  $('rError').textContent = '';
  $('rSubmit').disabled = false;
  $('reportDialog').showModal();
}

async function submitReport(event) {
  event.preventDefault();
  const { inst, kind } = reporting;
  $('rSubmit').disabled = true;
  $('rError').textContent = '送出中…';
  try {
    await api('/report', 'POST', {
      item_id: inst.item_id,
      branch_id: inst.branch_id,
      period_key: inst.period_key,
      kind,
      note: $('rNote').value,
      late_reason: $('rLate').value,
    });
    $('reportDialog').close();
    await load();
  } catch (err) {
    $('rError').textContent = err.message;
    $('rSubmit').disabled = false;
  }
}

async function undo(reportId) {
  if (!confirm('確定要撤回這筆回報嗎？')) return;
  try {
    await api(`/reports/${encodeURIComponent(reportId)}`, 'DELETE');
    await load();
  } catch (err) {
    alert(err.message);
  }
}
