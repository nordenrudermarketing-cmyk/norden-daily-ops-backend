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
let activeTab = 'today';
let housekeepingStaff = [];

document.getElementById('staffLine').textContent = staff.name;

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    document.getElementById('todayList').style.display = activeTab === 'today' ? 'block' : 'none';
    document.getElementById('monthList').style.display = activeTab === 'month' ? 'block' : 'none';
  });
});

document.getElementById('saveBtn').addEventListener('click', save);

init();

async function init() {
  housekeepingStaff = await fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}&category=housekeeping`).then((r) => r.json());
  loadToday();
  loadMonth();
}

async function loadToday() {
  const el = document.getElementById('todayList');
  el.innerHTML = '<p class="empty-state">載入中…</p>';
  const res = await fetch(`${API}/api/public-area-maintenance/today?branch_id=${staff.branch_id}&date=${today}`);
  const items = await res.json();
  render(el, items, CYCLE_ORDER_TODAY);
}

async function loadMonth() {
  const el = document.getElementById('monthList');
  el.innerHTML = '<p class="empty-state">載入中…</p>';
  const res = await fetch(`${API}/api/public-area-maintenance/month?branch_id=${staff.branch_id}&month=${monthStr}`);
  const items = await res.json();
  render(el, items, CYCLE_ORDER_MONTH);
}

function render(el, items, cycleOrder) {
  if (items.length === 0) {
    el.innerHTML = '<p class="empty-state">目前沒有項目。</p>';
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
    const row = document.createElement('div');
    row.className = 'assign-row' + (isDone ? ' done' : '');
    row.dataset.templateId = t.id;

    if (isDone) {
      row.innerHTML = `<span class="name">${t.task_name}</span><span class="card-meta">已完成（${t.completion.staff?.name || ''}）</span>`;
    } else {
      const select = document.createElement('select');
      select.innerHTML = '<option value="">未分配</option>' +
        housekeepingStaff.map((s) => `<option value="${s.id}" ${s.id === t.completion?.assigned_to ? 'selected' : ''}>${s.name}</option>`).join('');
      row.innerHTML = `<span class="name">${t.task_name}</span>`;
      row.appendChild(select);
    }
    el.appendChild(row);
  });
}

async function save() {
  const listEl = activeTab === 'today' ? document.getElementById('todayList') : document.getElementById('monthList');
  const assignments = [];
  listEl.querySelectorAll('.assign-row:not(.done)').forEach((row) => {
    const select = row.querySelector('select');
    if (select && select.value) {
      assignments.push({ template_id: row.dataset.templateId, staff_id: select.value });
    }
  });

  if (assignments.length === 0) { alert('沒有要儲存的分配'); return; }

  const periodKey = activeTab === 'today' ? today : monthStr;
  const btn = document.getElementById('saveBtn');
  btn.textContent = '儲存中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/public-area-maintenance/assign-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: staff.branch_id, period_key: periodKey, assignments }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '儲存失敗');
    alert('已儲存分配');
    if (activeTab === 'today') loadToday(); else loadMonth();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.textContent = '儲存分配';
    btn.disabled = false;
  }
}
