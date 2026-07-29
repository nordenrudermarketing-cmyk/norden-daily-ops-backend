const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const dateInput = document.getElementById('workDate');
dateInput.value = new Date().toISOString().slice(0, 10);
dateInput.addEventListener('change', loadAll);

document.getElementById('staffLine').textContent = staff.name;
document.getElementById('saveBtn').addEventListener('click', saveAssignments);

let rooms = [];
let housekeepingStaff = [];
let currentAssignments = {}; // room_id -> staff_id
let zoneOwners = {}; // zone -> staff_id

loadAll();

async function loadAll() {
  const listEl = document.getElementById('roomList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  try {
    const [roomsRes, staffRes, assignedRes, zoneOwnersRes] = await Promise.all([
      fetch(`${API}/api/rooms?branch_id=${staff.branch_id}`),
      fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}&category=housekeeping`),
      fetch(`${API}/api/room-cleanings/assignments?branch_id=${staff.branch_id}&date=${dateInput.value}`),
      fetch(`${API}/api/room-maintenance/zone-owners?branch_id=${staff.branch_id}`),
    ]);
    rooms = await roomsRes.json();
    housekeepingStaff = await staffRes.json();
    const assigned = await assignedRes.json();
    const zoneOwnersList = await zoneOwnersRes.json();

    currentAssignments = {};
    assigned.forEach((a) => { currentAssignments[a.room_id] = a.staff?.id || ''; });

    zoneOwners = {};
    (zoneOwnersList ?? []).forEach((o) => { zoneOwners[o.zone] = o.staff?.id || ''; });

    renderRooms();
  } catch (err) {
    listEl.innerHTML = `<p class="empty-state">讀取失敗：${err.message}</p>`;
  }
}

function renderRooms() {
  const listEl = document.getElementById('roomList');
  listEl.innerHTML = '';

  let assignedCount = 0;

  rooms.forEach((room) => {
    const current = currentAssignments[room.id] || '';
    if (current) assignedCount++;

    const row = document.createElement('div');
    row.className = 'card';
    row.style.padding = '10px 14px';

    const select = document.createElement('select');
    select.style.cssText = 'width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;font-size:14px;margin-top:6px;';
    select.dataset.roomId = room.id;

    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '未分配';
    select.appendChild(emptyOpt);

    housekeepingStaff.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      if (s.id === current) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', updateSummary);

    const ownerName = room.zone && zoneOwners[room.zone]
      ? housekeepingStaff.find((s) => s.id === zoneOwners[room.zone])?.name
      : null;
    const zoneLabel = room.zone
      ? `<span class="badge" style="margin-left:6px;">${room.zone}區${ownerName ? '・' + ownerName : ''}</span>`
      : '';
    row.innerHTML = `<span class="card-title">${room.room_number}${room.is_large ? '（大房）' : ''}${zoneLabel}</span>`;
    row.appendChild(select);
    listEl.appendChild(row);
  });

  document.getElementById('sumAssigned').textContent = assignedCount;
  document.getElementById('sumUnassigned').textContent = rooms.length - assignedCount;
}

function updateSummary() {
  const selects = document.querySelectorAll('#roomList select');
  let assignedCount = 0;
  selects.forEach((s) => { if (s.value) assignedCount++; });
  document.getElementById('sumAssigned').textContent = assignedCount;
  document.getElementById('sumUnassigned').textContent = selects.length - assignedCount;
}

async function saveAssignments() {
  const selects = document.querySelectorAll('#roomList select');
  const assignments = [];
  selects.forEach((s) => {
    if (s.value) assignments.push({ room_id: s.dataset.roomId, staff_id: s.value });
  });

  if (assignments.length === 0) { alert('至少要分配一間房'); return; }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.textContent = '儲存中…';
  saveBtn.disabled = true;

  try {
    const res = await fetch(`${API}/api/room-cleanings/assign-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: staff.branch_id,
        work_date: dateInput.value,
        assignments,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '儲存失敗');
    alert('已儲存分配');
    loadAll();
  } catch (err) {
    alert(err.message);
  } finally {
    saveBtn.textContent = '儲存分配';
    saveBtn.disabled = false;
  }
}
