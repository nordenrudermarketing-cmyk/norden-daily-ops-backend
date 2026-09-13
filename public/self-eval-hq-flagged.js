// 各館自評進度（總公司）
// 檔名沿用原本的「自評異常彙總」。這一頁只看完成進度，不列出勾「否」的項目——
// 勾否不代表異常，是同仁跟主管面談、討論怎麼改善的起點。

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const $ = (id) => document.getElementById(id);

let data = null;          // /api/self-eval/hq-progress 的回應
let currentBranchId = null;
let currentFilter = 'all';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// '2026-08-01' → '2026 年 8 月'
function monthLabel(evalMonth) {
  const [y, m] = evalMonth.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

$('monthSelect').addEventListener('change', () => load($('monthSelect').value));
$('backBtn').addEventListener('click', showOverview);
$('filterRow').querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    setActiveFilter();
    renderDetail();
  });
});

if (staff) load();

async function load(evalMonth) {
  $('loading').textContent = '載入中…';
  $('loading').style.display = '';
  $('overviewView').style.display = 'none';
  $('detailView').style.display = 'none';

  try {
    const qs = evalMonth ? `?eval_month=${encodeURIComponent(evalMonth)}` : '';
    const res = await fetch(`${API}/api/self-eval/hq-progress${qs}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '載入失敗');
    data = json;
  } catch (err) {
    // Supabase 免費方案偶爾會查詢逾時（回傳 Gateway Timeout），重試通常就好了
    $('loading').innerHTML =
      `載入失敗，請稍後再試（${escapeHtml(err.message)}）<br>` +
      '<button id="retryBtn" style="margin-top:10px;padding:6px 16px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer;font-family:inherit;">重試</button>';
    $('retryBtn').addEventListener('click', () => load(evalMonth || $('monthSelect').value || undefined));
    return;
  }

  $('loading').style.display = 'none';
  $('monthSelect').innerHTML = data.months.map((m) =>
    `<option value="${m}" ${m === data.eval_month ? 'selected' : ''}>${monthLabel(m)}${m === data.current_eval_month ? '（本期）' : ''}</option>`
  ).join('');
  renderSchedule();

  // 換月份時，如果本來在看某個館，就停留在那個館
  if (currentBranchId && data.branches.some((b) => b.branch_id === currentBranchId)) {
    renderDetail();
    $('detailView').style.display = '';
  } else {
    showOverview();
  }
}

function renderSchedule() {
  const fillPassed = data.today > data.staff_due_date;
  const interviewPassed = data.today > data.interview_due_date;
  $('scheduleLine').innerHTML =
    `${data.release_date} 發布・同仁填寫截止 <strong>${data.staff_due_date}</strong>` +
    `${fillPassed ? '<span class="passed">（已截止）</span>' : ''}` +
    `・主管面談截止 <strong>${data.interview_due_date}</strong>` +
    `${interviewPassed ? '<span class="passed">（已截止）</span>' : ''}`;
}

function stageRow(label, done, total, overdue) {
  const todo = total - done;
  return `
    <div class="stage">
      <span>${label}</span>
      <span class="counts">
        <span class="pill done">已完成 ${done}</span>
        <span class="pill ${overdue > 0 ? 'late' : 'todo'}">未完成 ${todo}${overdue > 0 ? '・逾期' : ''}</span>
      </span>
    </div>`;
}

function showOverview() {
  currentBranchId = null;
  $('detailView').style.display = 'none';
  $('overviewView').style.display = '';

  // 總公司自己沒有同仁的話就不顯示
  const branches = data.branches.filter((b) => !b.is_hq || b.total > 0);
  const total = branches.reduce((n, b) => n + b.total, 0);
  const fillDone = branches.reduce((n, b) => n + b.fill_done, 0);
  const interviewDone = branches.reduce((n, b) => n + b.interview_done, 0);

  $('overall').innerHTML = `
    <div class="overall-item"><div class="label">全公司・同仁填寫</div><div class="value">${fillDone} <small>/ ${total} 人</small></div></div>
    <div class="overall-item"><div class="label">全公司・主管面談</div><div class="value">${interviewDone} <small>/ ${total} 人</small></div></div>`;

  $('branchGrid').innerHTML = branches.map((b) => {
    const attention = b.fill_overdue > 0 || b.interview_overdue > 0;
    const empty = b.total === 0;
    return `
      <button class="branch-card ${attention ? 'attention' : ''} ${empty ? 'empty' : ''}" data-id="${b.branch_id}" ${empty ? 'disabled' : ''}>
        <h3>${escapeHtml(b.branch_name)}</h3>
        <p class="headcount">${empty ? '目前沒有同仁' : `應填 ${b.total} 人`}</p>
        ${stageRow('同仁填寫', b.fill_done, b.total, b.fill_overdue)}
        ${stageRow('主管面談', b.interview_done, b.total, b.interview_overdue)}
        ${empty ? '' : '<p class="card-foot">查看每位同仁 →</p>'}
      </button>`;
  }).join('');

  $('branchGrid').querySelectorAll('.branch-card:not(.empty)').forEach((card) => {
    card.addEventListener('click', () => showDetail(card.dataset.id));
  });
}

function showDetail(branchId) {
  currentBranchId = branchId;
  currentFilter = 'all';
  setActiveFilter();
  $('overviewView').style.display = 'none';
  $('detailView').style.display = '';
  renderDetail();
  window.scrollTo(0, 0);
}

function setActiveFilter() {
  $('filterRow').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.filter === currentFilter);
  });
}

function fillCell(s) {
  if (s.fill_status === 'done') {
    return `<span class="pill done">已送出</span>` +
      `<span class="sub ${s.submitted_late ? 'warn' : ''}">${s.submitted_on || ''}${s.submitted_late ? '・超過期限才送出' : ''}</span>`;
  }
  const label = s.fill_status === 'draft' ? '填寫中（草稿）' : '尚未填寫';
  return `<span class="pill ${s.fill_overdue ? 'late' : 'todo'}">${label}</span>` +
    `${s.fill_overdue ? '<span class="sub warn">已超過填寫期限</span>' : ''}`;
}

function interviewCell(s) {
  if (s.interview_status === 'done') {
    return `<span class="pill done">已完成面談</span>` +
      `<span class="sub ${s.reviewed_late ? 'warn' : ''}">面談日期 ${escapeHtml(s.interview_date || s.reviewed_on || '—')}${s.reviewed_late ? '・超過期限才完成' : ''}</span>`;
  }
  if (s.fill_status !== 'done') {
    return `<span class="pill todo">等同仁送出</span>` +
      `${s.interview_overdue ? '<span class="sub warn">已超過面談期限</span>' : ''}`;
  }
  return `<span class="pill ${s.interview_overdue ? 'late' : 'todo'}">待面談</span>` +
    `${s.interview_overdue ? '<span class="sub warn">已超過面談期限</span>' : ''}`;
}

function renderDetail() {
  const b = data.branches.find((x) => x.branch_id === currentBranchId);
  if (!b) {
    showOverview();
    return;
  }

  $('detailTitle').textContent = `${b.branch_name}・${monthLabel(data.eval_month)}`;
  $('detailSummary').textContent =
    `同仁填寫 已完成 ${b.fill_done} / ${b.total}・主管面談 已完成 ${b.interview_done} / ${b.total}`;

  const rows = b.staff.filter((s) =>
    currentFilter === 'all' ||
    (currentFilter === 'fill_todo' && s.fill_status !== 'done') ||
    (currentFilter === 'interview_todo' && s.interview_status !== 'done')
  );

  if (rows.length === 0) {
    $('staffBody').innerHTML = '<tr><td colspan="3" style="color:var(--ink-soft);">沒有符合條件的同仁</td></tr>';
    return;
  }

  $('staffBody').innerHTML = rows.map((s) => `
    <tr>
      <td>${escapeHtml(s.name)}<span class="sub">${escapeHtml(s.role_name || '')}${s.inactive ? '・已停用' : ''}</span></td>
      <td>${fillCell(s)}</td>
      <td>${interviewCell(s)}</td>
    </tr>`).join('');
}
