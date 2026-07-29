const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CYCLE_LABEL = {
  daily_am: '早上日常公區', daily_pm: '下午日常公區', team_lead: '隊長任務',
  weekly_odd: '每週輪替（本週）', weekly_even: '每週輪替（本週）',
  monthly: '月清', quarterly: '季清', bimonthly_odd: '雙月清（本月）', bimonthly_even: '雙月清（本月）',
};
const CYCLE_ORDER_TODAY = ['daily_am', 'daily_pm', 'team_lead', 'weekly_odd', 'weekly_even'];
const CYCLE_ORDER_MONTH = ['monthly', 'quarterly', 'bimonthly_odd', 'bimonthly_even'];

const today = new Date().toISOString().slice(0, 10);
const monthStr = today.slice(0, 7);

document.getElementById('staffLine').textContent = `${staff.name}・${today}`;

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('todayList').style.display = btn.dataset.tab === 'today' ? 'block' : 'none';
    document.getElementById('monthList').style.display = btn.dataset.tab === 'month' ? 'block' : 'none';
  });
});

loadToday();
loadMonth();

async function loadToday() {
  const el = document.getElementById('todayList');
  el.innerHTML = '<p class="empty-state">載入中…</p>';
  const res = await fetch(`${API}/api/public-area-maintenance/today?branch_id=${staff.branch_id}&date=${today}&staff_id=${staff.id}`);
  const items = await res.json();
  render(el, items, CYCLE_ORDER_TODAY, 'today');
}

async function loadMonth() {
  const el = document.getElementById('monthList');
  el.innerHTML = '<p class="empty-state">載入中…</p>';
  const res = await fetch(`${API}/api/public-area-maintenance/month?branch_id=${staff.branch_id}&month=${monthStr}&staff_id=${staff.id}`);
  const items = await res.json();
  render(el, items, CYCLE_ORDER_MONTH, 'month');
}

function render(el, items, cycleOrder, periodType) {
  if (items.length === 0) {
    el.innerHTML = '<p class="empty-state">目前還沒有分配到任何項目，請跟小隊長確認。</p>';
    return;
  }

  const sorted = [...items].sort((a, b) => {
    const diff = cycleOrder.indexOf(a.cycle) - cycleOrder.indexOf(b.cycle);
    return diff !== 0 ? diff : (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  el.innerHTML = '';
  let lastCycle = null;
  sorted.forEach((t) => {
    if (t.cycle !== lastCycle) {
      const title = document.createElement('div');
      title.className = 'cycle-title';
      title.textContent = CYCLE_LABEL[t.cycle] || t.cycle;
      el.appendChild(title);
      lastCycle = t.cycle;
    }

    const isDone = t.completion?.status === 'completed';
    const card = document.createElement('div');
    card.className = 'card' + (isDone ? ' done' : '');

    if (isDone) {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${t.task_name}</span>
          <span class="card-meta">${t.completion.staff?.name || ''}・${new Date(t.completion.completed_at).toLocaleDateString('zh-TW')}</span>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="card-row"><span class="card-title">${t.task_name}</span></div>
        <div class="action-row"><button class="btn">標記完成</button></div>`;
      card.querySelector('button').addEventListener('click', () => complete(t.id, periodType));
    }
    el.appendChild(card);
  });
}

async function complete(templateId, periodType) {
  const periodKey = periodType === 'today' ? today : monthStr;
  await fetch(`${API}/api/public-area-maintenance/${templateId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch_id: staff.branch_id, staff_id: staff.id, period_key: periodKey }),
  });
  if (periodType === 'today') loadToday(); else loadMonth();
}
