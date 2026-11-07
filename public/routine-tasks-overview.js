// 例行任務執行狀況（總公司行政、總辦公室）：某一週／月／年，各部門每個任務做到哪裡
// 資料來自 /api/routine-tasks/overview（gas/Routine.gs）

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const level = staff ? window.accountLevelOf(staff) : null;

const $ = (id) => document.getElementById(id);

let period = 'week';
let board = null;

if (!staff) {
  window.location.href = 'index.html';
} else if (level === 'manager') {
  window.location.href = 'routine-tasks.html';
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

function init() {
  $('tabs').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      period = btn.dataset.period;
      load();
    });
  });
  $('prevBtn').addEventListener('click', () => load(board.prev_key));
  $('nextBtn').addEventListener('click', () => load(board.next_key));
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
  load();
}

async function load(key) {
  $('tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.period === period));
  $('board').innerHTML = '<p class="empty-state">載入中…</p>';
  $('statusLine').textContent = '';
  try {
    const query = `period=${period}${key ? `&key=${encodeURIComponent(key)}` : ''}`;
    const res = await fetch(`${API}/api/routine-tasks/overview?${query}`);
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '載入失敗');
    board = result;
  } catch (err) {
    $('board').innerHTML = '';
    $('statusLine').textContent = err.message;
    return;
  }
  render();
}

function render() {
  $('periodLabel').textContent = board.label;
  $('nowTag').textContent = board.is_current ? '（這一期）' : '';
  $('nextBtn').disabled = !board.next_key;

  if (board.branches.length === 0) {
    $('branchStats').innerHTML = '';
    $('board').innerHTML = '<p class="empty-state">還沒有部門設定負責的主管。<br>請在「帳號管理」→ 主管的「管轄設定」勾選管轄部門。</p>';
    return;
  }

  $('branchStats').innerHTML = board.branches.map((b) => {
    const s = b.stats;
    return `<div class="bstat">
      <h3>${escapeHtml(b.name)}</h3>
      <p class="who">主管：${escapeHtml(b.executors.join('、'))}</p>
      <p class="nums">完成 ${s.done}／${s.total}${s.missed ? `　未能完成 ${s.missed}` : ''}${s.overdue ? `　<span class="warn">逾期 ${s.overdue}</span>` : ''}</p>
    </div>`;
  }).join('');

  if (board.rows.length === 0) {
    $('board').innerHTML = '<p class="empty-state">這個週期還沒有設定任務。</p>';
    return;
  }

  let lastCat = null;
  const body = board.rows.map((row, r) => {
    const catRow = row.category !== lastCat ? `<tr class="cat"><td colspan="${board.branches.length + 1}">${escapeHtml(row.category)}</td></tr>` : '';
    lastCat = row.category;
    return `${catRow}<tr>
      <td class="task-name">${escapeHtml(row.title)}<small>${escapeHtml(row.due_label)}${row.times > 1 ? `・每期 ${row.times} 次` : ''}</small></td>
      ${row.cells.map((c, b) => cellHtml(c, r, b)).join('')}
    </tr>`;
  }).join('');

  $('board').innerHTML = `<div class="table-wrap"><table class="board">
    <thead><tr><th>任務</th>${board.branches.map((b) => `<th>${escapeHtml(b.name)}</th>`).join('')}</tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;

  $('board').querySelectorAll('td.cell[data-r]').forEach((td) => {
    td.addEventListener('click', () => openDetail(Number(td.dataset.r), Number(td.dataset.b)));
  });
}

function cellHtml(c, r, b) {
  if (!c) return '<td class="cell na">—</td>';
  let text;
  if (c.status === 'done') text = '<span class="c-done">✓</span>';
  else if (c.status === 'missed') text = '<span class="c-muted">✕ 未能完成</span>';
  else if (c.status === 'overdue') text = `<span class="c-warn">逾期${c.times > 1 ? ` ${c.done_count}/${c.times}` : ''}</span>`;
  else if (c.status === 'backlog') text = '<span class="c-warn">積壓</span>';
  else if (c.status === 'upcoming') text = '<span class="c-muted">未開始</span>';
  else text = `<span class="c-muted">${c.times > 1 ? `${c.done_count}/${c.times}` : '進行中'}</span>`;
  // 有回報內容的格子才能點開
  return c.reports.length
    ? `<td class="cell" data-r="${r}" data-b="${b}">${text} <span class="c-muted">›</span></td>`
    : `<td class="cell">${text}</td>`;
}

function openDetail(r, b) {
  const row = board.rows[r];
  const cell = row.cells[b];
  $('dTitle').textContent = row.title;
  $('dSub').textContent = `${board.branches[b].name}・${board.label}`;
  $('dBody').innerHTML = cell.reports.map((x) => `
    <div class="report">
      <strong>${escapeHtml(x.staff_name)}</strong>　${escapeHtml(x.at_label)}　${x.kind === 'missed' ? '未能完成' : '完成'}
      ${x.note ? `<br>${escapeHtml(x.note)}` : ''}
      ${x.late_reason ? `<br><span class="late">逾期原因：${escapeHtml(x.late_reason)}</span>` : ''}
    </div>`).join('');
  $('detailDialog').showModal();
}
