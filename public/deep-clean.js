const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const FLOORS = [8, 9, 10, 11, 12];
const month = new Date().toISOString().slice(0, 7) + '-01';

document.getElementById('staffLine').textContent = `${staff.name}・${month.slice(0, 7)}`;
document.getElementById('generateBtn').addEventListener('click', generate);

let housekeepingStaff = [];
let currentOwners = {}; // floor -> staff_id

init();

async function init() {
  const staffRes = await fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}&category=housekeeping`);
  housekeepingStaff = await staffRes.json();

  await loadOwners();
  renderWeekGrid();
  await loadMonthTasks();
}

async function loadOwners() {
  const res = await fetch(`${API}/api/deep-clean/floor-owners?branch_id=${staff.branch_id}`);
  const owners = await res.json();
  currentOwners = {};
  owners.forEach((o) => { currentOwners[o.floor] = o.staff?.id || ''; });
  renderOwnerGrid();
}

function renderOwnerGrid() {
  const grid = document.getElementById('ownerGrid');
  grid.innerHTML = '';
  FLOORS.forEach((floor) => {
    const cell = document.createElement('div');
    cell.className = 'owner-cell';
    const select = document.createElement('select');
    select.dataset.floor = floor;
    select.innerHTML = '<option value="">未指定</option>' +
      housekeepingStaff.map((s) => `<option value="${s.id}" ${s.id === currentOwners[floor] ? 'selected' : ''}>${s.name}</option>`).join('');
    select.addEventListener('change', () => saveOwner(floor, select.value));
    cell.innerHTML = `<label>${floor}F</label>`;
    cell.appendChild(select);
    grid.appendChild(cell);
  });
}

async function saveOwner(floor, staffId) {
  if (!staffId) return;
  await fetch(`${API}/api/deep-clean/floor-owners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch_id: staff.branch_id, floor, staff_id: staffId }),
  });
}

function renderWeekGrid() {
  const grid = document.getElementById('weekGrid');
  grid.innerHTML = '';
  FLOORS.forEach((floor, idx) => {
    const cell = document.createElement('div');
    cell.className = 'owner-cell';
    const select = document.createElement('select');
    select.dataset.floor = floor;
    const defaultWeek = (idx % 4) + 1;
    select.innerHTML = [1, 2, 3, 4].map((w) => `<option value="${w}" ${w === defaultWeek ? 'selected' : ''}>第${w}週</option>`).join('');
    cell.innerHTML = `<label>${floor}F</label>`;
    cell.appendChild(select);
    grid.appendChild(cell);
  });
}

async function generate() {
  const floorWeeks = {};
  document.querySelectorAll('#weekGrid select').forEach((s) => { floorWeeks[s.dataset.floor] = Number(s.value); });

  const btn = document.getElementById('generateBtn');
  btn.textContent = '產生中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/deep-clean/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: staff.branch_id, month, floor_weeks: floorWeeks }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '產生失敗');
    alert(`已產生 ${result.inserted} 筆任務`);
    loadMonthTasks();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.textContent = '產生本月任務（不會覆蓋已完成項目）';
    btn.disabled = false;
  }
}

async function loadMonthTasks() {
  const listEl = document.getElementById('taskList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/deep-clean/month?branch_id=${staff.branch_id}&month=${month}`);
  const tasks = await res.json();

  if (tasks.length === 0) {
    listEl.innerHTML = '<p class="empty-state">本月還沒有任務，先設定樓主跟週次後按上面的產生按鈕。</p>';
    return;
  }

  listEl.innerHTML = '';
  tasks.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'card' + (t.status === 'completed' ? ' done' : '');
    const floorLabel = t.template.floor ? `${t.template.floor}F` : '';
    card.innerHTML = `
      <div class="card-row">
        <span class="card-title">${floorLabel} ${t.template.task_name}<span class="week-badge">第${t.week_number}週</span></span>
      </div>
      <div class="card-meta">樓主：${t.owner?.name || '未指定'}</div>`;

    if (t.status !== 'completed') {
      const actionRow = document.createElement('div');
      actionRow.className = 'action-row';
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = '標記完成';
      btn.addEventListener('click', () => completeTask(t.id));
      actionRow.appendChild(btn);
      card.appendChild(actionRow);
    }
    listEl.appendChild(card);
  });
}

async function completeTask(id) {
  await fetch(`${API}/api/deep-clean/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checked_by: staff.id }),
  });
  loadMonthTasks();
}
