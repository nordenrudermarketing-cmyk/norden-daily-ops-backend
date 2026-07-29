const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CYCLE_LABEL = { week1: '第一週', week2: '第二週', week3: '第三週', week4: '第四週', monthly: '月任務', quarterly: '季清' };
const PAINT_OPTIONS = [
  ['clean', '○ 乾淨'],
  ['needs_paint', '△ 需油漆'],
  ['wall_disease', '壁癌'],
];

document.getElementById('staffLine').textContent = staff.name;

const monthInput = document.getElementById('monthInput');
monthInput.value = new Date().toISOString().slice(0, 7);
monthInput.addEventListener('change', loadZoneData);

const zoneSelect = document.getElementById('zoneSelect');
zoneSelect.addEventListener('change', () => { loadOwnerForZone(); loadZoneData(); loadPaint(); });

document.getElementById('generateBtn').addEventListener('click', generate);
document.getElementById('ownerSelect').addEventListener('change', saveOwner);

let housekeepingStaff = [];
let zoneOwners = {}; // zone -> staff_id

init();

async function init() {
  const [zonesRes, staffRes] = await Promise.all([
    fetch(`${API}/api/room-maintenance/zones?branch_id=${staff.branch_id}`).then((r) => r.json()),
    fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}&category=housekeeping`).then((r) => r.json()),
  ]);
  housekeepingStaff = staffRes;
  zoneSelect.innerHTML = zonesRes.map((z) => `<option value="${z}">${z}區</option>`).join('');

  const ownerSelect = document.getElementById('ownerSelect');
  ownerSelect.innerHTML = '<option value="">未指定</option>' + housekeepingStaff.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');

  await loadOwners();
  loadOwnerForZone();
  loadZoneData();
  loadPaint();
}

async function loadOwners() {
  const res = await fetch(`${API}/api/room-maintenance/zone-owners?branch_id=${staff.branch_id}`);
  const owners = await res.json();
  zoneOwners = {};
  owners.forEach((o) => { zoneOwners[o.zone] = o.staff?.id || ''; });
}

function loadOwnerForZone() {
  document.getElementById('ownerSelect').value = zoneOwners[zoneSelect.value] || '';
}

async function saveOwner() {
  const zone = zoneSelect.value;
  const staffId = document.getElementById('ownerSelect').value;
  if (!staffId) return;
  await fetch(`${API}/api/room-maintenance/zone-owners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch_id: staff.branch_id, zone, staff_id: staffId }),
  });
  zoneOwners[zone] = staffId;
}

async function generate() {
  const monthDate = `${monthInput.value}-01`;
  const btn = document.getElementById('generateBtn');
  btn.textContent = '產生中…';
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/room-maintenance/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: staff.branch_id, month: monthDate }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '產生失敗');
    alert(`已產生 ${result.inserted} 筆任務`);
    loadZoneData();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.textContent = '產生本月任務（全部責任區）';
    btn.disabled = false;
  }
}

async function loadZoneData() {
  const table = document.getElementById('maintTable');
  table.innerHTML = '<tr><td>載入中…</td></tr>';

  const monthDate = `${monthInput.value}-01`;
  const zone = zoneSelect.value;
  if (!zone) return;

  const res = await fetch(`${API}/api/room-maintenance/month?branch_id=${staff.branch_id}&month=${monthDate}&zone=${zone}`);
  const data = await res.json();
  renderTable(data);
}

function renderTable(data) {
  const { rooms, templates, completions } = data;
  const table = document.getElementById('maintTable');
  table.innerHTML = '';

  if (rooms.length === 0 || templates.length === 0) {
    table.innerHTML = '<tr><td>沒有資料，請確認房號跟任務範本都已建立。</td></tr>';
    return;
  }

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th class="task-col">任務項目</th>' +
    rooms.map((r) => `<th>${r.room_number}${r.is_large ? '(大)' : ''}</th>`).join('');
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  let lastCycle = null;
  templates.forEach((t) => {
    if (t.cycle !== lastCycle) {
      const cycleRow = document.createElement('tr');
      cycleRow.className = 'cycle-row';
      cycleRow.innerHTML = `<td colspan="${rooms.length + 1}">${CYCLE_LABEL[t.cycle] || t.cycle}</td>`;
      tbody.appendChild(cycleRow);
      lastCycle = t.cycle;
    }

    const tr = document.createElement('tr');
    const taskTd = document.createElement('td');
    taskTd.className = 'task-col';
    taskTd.textContent = t.task_name;
    tr.appendChild(taskTd);

    rooms.forEach((r) => {
      const comp = completions[`${t.id}_${r.id}`];
      const td = document.createElement('td');
      td.className = 'cell' + (comp?.status === 'completed' ? ' done' : '');
      td.textContent = comp?.status === 'completed' ? '✓' : '';
      if (comp) {
        td.addEventListener('click', () => {
          if (comp.status === 'completed') return; // 已完成的不重複點
          completeCell(comp.id, td);
        });
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

async function completeCell(completionId, td) {
  await fetch(`${API}/api/room-maintenance/${completionId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.id }),
  });
  td.textContent = '✓';
  td.classList.add('done');
}

async function loadPaint() {
  const zone = zoneSelect.value;
  if (!zone) return;
  const res = await fetch(`${API}/api/room-maintenance/paint?branch_id=${staff.branch_id}&zone=${zone}`);
  const rooms = await res.json();

  const body = document.querySelector('#paintTable tbody');
  body.innerHTML = '';
  rooms.forEach((r) => {
    const tr = document.createElement('tr');
    const statusSelect = PAINT_OPTIONS.map(([v, label]) => `<option value="${v}" ${r.paint?.status === v ? 'selected' : ''}>${label}</option>`).join('');
    tr.innerHTML = `
      <td>${r.room_number}</td>
      <td><select data-field="status">${statusSelect}</select></td>
      <td><input type="text" data-field="note" value="${r.paint?.note || ''}" placeholder="備註"></td>
      <td><button class="small-btn">儲存</button></td>`;
    tr.querySelector('button').addEventListener('click', () => savePaint(r.id, tr));
    body.appendChild(tr);
  });
}

async function savePaint(roomId, tr) {
  const status = tr.querySelector('[data-field="status"]').value;
  const note = tr.querySelector('[data-field="note"]').value;
  await fetch(`${API}/api/room-maintenance/paint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId, status, note, staff_id: staff.id }),
  });
  alert('已儲存');
}
