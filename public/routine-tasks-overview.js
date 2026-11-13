// 例行任務執行狀況（人事行政、總辦公室）：某一週／月／年，各部門每個任務做到哪裡
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

  renderReasons();

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

// 這一期所有「逾期完成、未能完成、逾期還沒回報」的原因，依部門列出來，不用一格一格點開
function renderReasons() {
  const entries = [];
  board.rows.forEach((row) => {
    row.cells.forEach((c, b) => {
      if (!c) return;
      const base = { branch: board.branches[b].name, title: row.title };
      c.reports.forEach((x) => {
        if (x.kind === 'missed') entries.push({ ...base, kind: 'missed', text: x.note, who: x.staff_name, at: x.at_label });
        else if (x.late_reason) entries.push({ ...base, kind: 'late', text: x.late_reason, who: x.staff_name, at: x.at_label });
      });
      if (c.status === 'overdue' || c.status === 'backlog') {
        const progress = c.times > 1 ? `（做了 ${c.done_count}/${c.times} 次）` : '';
        entries.push({ ...base, kind: 'none', text: `過了期限還沒回報${progress}` });
      }
    });
  });

  $('reasonsTitle').textContent = `逾期與未能完成（${entries.length}）`;
  if (entries.length === 0) {
    $('reasons').innerHTML = '<p class="reasons-hint">這一期沒有逾期或未能完成的任務 👍</p>';
    return;
  }
  const KIND = { late: '逾期完成', missed: '未能完成', none: '逾期未回報' };
  const groups = new Map();
  entries.forEach((e) => {
    if (!groups.has(e.branch)) groups.set(e.branch, []);
    groups.get(e.branch).push(e);
  });
  $('reasons').innerHTML = '<p class="reasons-hint">主管寫的逾期原因、未能完成的原因，月會檢討時可以直接看這裡。</p>' +
    [...groups.entries()].map(([branch, list]) => `
      <p class="reason-group">${escapeHtml(branch)}（${list.length}）</p>
      ${list.map((e) => `<div class="reason">
        <span class="kind ${e.kind}">${KIND[e.kind]}</span><strong>${escapeHtml(e.title)}</strong>
        <br>${escapeHtml(e.text)}
        ${e.who ? `<br><span class="meta">${escapeHtml(e.who)}・${escapeHtml(e.at)}</span>` : ''}
      </div>`).join('')}`).join('');
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
