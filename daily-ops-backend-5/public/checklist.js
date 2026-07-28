const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);

document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('staff');
  window.location.href = 'index.html';
});

loadRooms();

async function loadRooms() {
  const listEl = document.getElementById('roomList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  try {
    const res = await fetch(`${API}/api/room-cleanings/mine?staff_id=${staff.id}&date=${today}`);
    if (!res.ok) throw new Error('讀取失敗');
    const rooms = await res.json();
    renderRooms(rooms);
  } catch (err) {
    listEl.innerHTML = `<p class="empty-state">讀取失敗：${err.message}</p>`;
  }
}

function renderRooms(rooms) {
  const listEl = document.getElementById('roomList');

  const done = rooms.filter((r) => r.status === 'completed').length;
  const defect = rooms.filter((r) => r.has_defect && !r.defect_resolved).length;
  document.getElementById('sumDone').textContent = done;
  document.getElementById('sumDefect').textContent = defect;
  document.getElementById('sumRemaining').textContent = rooms.length - done;

  if (rooms.length === 0) {
    listEl.innerHTML = '<p class="empty-state">今天還沒有分配到房號，請跟小隊長確認。</p>';
    return;
  }

  listEl.innerHTML = '';
  rooms.forEach((r) => {
    const room = r.rooms;
    const card = document.createElement('div');
    const isDone = r.status === 'completed';
    const hasOpenDefect = r.has_defect && !r.defect_resolved;
    card.className = 'card' + (isDone && !hasOpenDefect ? ' done' : '') + (hasOpenDefect ? ' flagged' : '');

    const title = room.room_number + (room.is_large ? '（大房）' : '');

    if (hasOpenDefect) {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${title}</span>
          <span class="badge" style="background:var(--danger-soft);color:var(--danger);">缺失</span>
        </div>
        <p class="card-note">${r.defect_note || ''}</p>
        <div class="action-row">
          <button class="btn">標記已處理</button>
        </div>`;
      card.querySelector('button').addEventListener('click', () => resolveDefect(r.id));
    } else if (r.has_defect && r.defect_resolved) {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${title}</span>
          <span class="card-meta">缺失已處理</span>
        </div>`;
    } else if (isDone) {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${title}</span>
          <span class="card-meta">已完成・${new Date(r.completed_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${title}</span>
        </div>
        <div class="action-row">
          <button class="btn">標記完成</button>
        </div>`;
      card.querySelector('button').addEventListener('click', () => completeRoom(r.id));
    }
    listEl.appendChild(card);
  });
}

async function resolveDefect(cleaningId) {
  try {
    const res = await fetch(`${API}/api/room-cleanings/${cleaningId}/resolve-defect`, { method: 'POST' });
    if (!res.ok) throw new Error('標記失敗');
    loadRooms();
  } catch (err) {
    alert(err.message);
  }
}

async function completeRoom(cleaningId) {
  const now = new Date();
  const deadline = new Date();
  deadline.setHours(15, 0, 0, 0);

  try {
    const res = await fetch(`${API}/api/room-cleanings/${cleaningId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_before_deadline: now <= deadline }),
    });
    if (!res.ok) throw new Error('標記失敗');
    loadRooms();
  } catch (err) {
    alert(err.message);
  }
}
