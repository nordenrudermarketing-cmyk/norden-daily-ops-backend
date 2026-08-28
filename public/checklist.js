const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

// 用「當地時間」算今天的日期，不要用 toISOString()（那個算的是UTC時間，
// 在台灣時間凌晨0點到早上8點之間會算成「昨天」，導致抓不到今天分配的房間）
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = getLocalDateString();

document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
// 登出功能已經移到左側選單（sidebar.js）處理，這裡加個保護避免萬一頁面上還留著舊按鈕
const oldLogoutBtn = document.getElementById('logoutBtn');
if (oldLogoutBtn) {
  oldLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('staff');
    window.location.href = 'index.html';
  });
}

// 依館別是否使用「A-E責任區」制度，決定顯示樓層版（台中館）還是責任區版（台東1館）的保養排程連結
(async () => {
  try {
    const res = await fetch(`${API}/api/room-maintenance/zones?branch_id=${staff.branch_id}`);
    const zones = await res.json();
    const slot = document.getElementById('maintenanceLinkSlot');
    if (zones && zones.length > 0) {
      slot.innerHTML = '<a href="zone-maintenance.html" style="font-size:12px;color:var(--accent);">責任區保養排程 →</a>';
    } else {
      slot.innerHTML = '<a href="deep-clean.html" style="font-size:12px;color:var(--accent);">樓主：本月細清排程 →</a>';
    }
  } catch (e) {
    // 查不到就不顯示，不影響其他功能
  }
})();

// 只有今天排班表指定的小隊長，才看得到「今日房號分配」「公區任務分配」這兩個連結
(async () => {
  try {
    const res = await fetch(`${API}/api/schedule/team-lead-today?branch_id=${staff.branch_id}&date=${today}`);
    const result = await res.json();
    if (result.staff_id === staff.id) {
      document.getElementById('assignLink').style.display = 'inline';
      document.getElementById('assignSep').style.display = 'inline';
      document.getElementById('paAssignLink').style.display = 'inline';
      document.getElementById('paAssignSep').style.display = 'inline';
    }
  } catch (e) {
    // 查不到就維持隱藏，不影響其他功能
  }
})();

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
