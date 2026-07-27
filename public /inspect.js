const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
let activeCleaningId = null;

document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('staff');
  window.location.href = 'index.html';
});
document.getElementById('defectCancel').addEventListener('click', closeOverlay);
document.getElementById('defectSubmit').addEventListener('click', submitDefect);

loadQueue();

async function loadQueue() {
  const listEl = document.getElementById('roomList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  try {
    const res = await fetch(`${API}/api/room-cleanings/pending-inspection?branch_id=${staff.branch_id}&date=${today}`);
    if (!res.ok) throw new Error('讀取失敗');
    const rooms = await res.json();
    renderQueue(rooms);
  } catch (err) {
    listEl.innerHTML = `<p class="empty-state">讀取失敗：${err.message}</p>`;
  }
}

function renderQueue(rooms) {
  const listEl = document.getElementById('roomList');
  if (rooms.length === 0) {
    listEl.innerHTML = '<p class="empty-state">目前沒有待檢查的房間。</p>';
    return;
  }

  listEl.innerHTML = '';
  rooms.forEach((r) => {
    const room = r.rooms;
    const card = document.createElement('div');
    card.className = 'card active';
    card.innerHTML = `
      <div class="card-row">
        <span class="card-title">${room.room_number}${room.is_large ? '（大房）' : ''}</span>
        <span class="card-meta">房務：${r.staff?.name || '—'}</span>
      </div>
      <div class="action-row">
        <button class="secondary">正常</button>
        <button class="danger-outline">回報缺失</button>
      </div>`;
    const [okBtn, defectBtn] = card.querySelectorAll('button');
    okBtn.addEventListener('click', () => markInspected(r.id, false));
    defectBtn.addEventListener('click', () => openOverlay(r.id, room.room_number));
    listEl.appendChild(card);
  });
}

function openOverlay(cleaningId, roomNumber) {
  activeCleaningId = cleaningId;
  document.getElementById('defectRoomTitle').textContent = `回報缺失・${roomNumber}`;
  document.getElementById('defectNote').value = '';
  document.getElementById('defectPhoto').value = '';
  document.getElementById('defectOverlay').style.display = 'flex';
}

function closeOverlay() {
  document.getElementById('defectOverlay').style.display = 'none';
  activeCleaningId = null;
}

async function submitDefect() {
  const note = document.getElementById('defectNote').value.trim();
  if (!note) { alert('請填寫缺失說明'); return; }

  const fileInput = document.getElementById('defectPhoto');
  let photoDataUrl = null;
  if (fileInput.files[0]) {
    photoDataUrl = await fileToDataUrl(fileInput.files[0]);
  }

  await markInspected(activeCleaningId, true, note, photoDataUrl);
  closeOverlay();
}

async function markInspected(cleaningId, hasDefect, note = null, photoUrl = null) {
  try {
    const res = await fetch(`${API}/api/room-cleanings/${cleaningId}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checked_by: staff.id,
        branch_id: staff.branch_id,
        has_defect: hasDefect,
        defect_note: note,
        defect_photo_url: photoUrl,
      }),
    });
    if (!res.ok) throw new Error('送出失敗');
    loadQueue();
  } catch (err) {
    alert(err.message);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
