const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
document.getElementById('overlayCancel').addEventListener('click', closeOverlay);
document.getElementById('overlaySubmit').addEventListener('click', submitWithNote);

let activePlatform = null;

load();

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';
  const res = await fetch(`${API}/api/review-checks/today?branch_id=${staff.branch_id}&date=${today}`);
  const items = await res.json();

  listEl.innerHTML = '';
  items.forEach((it) => {
    const isDone = it.status === 'checked';
    const card = document.createElement('div');
    card.className = 'card' + (isDone ? ' done' : '');

    if (isDone) {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${it.platform}</span>
          <span class="card-meta">${it.staff?.name || ''}・${new Date(it.checked_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ${it.note ? `<p class="card-note">${it.note}</p>` : ''}`;
    } else {
      card.innerHTML = `
        <div class="card-row"><span class="card-title">${it.platform}</span></div>
        <div class="action-row">
          <button class="btn">已檢查・正常</button>
          <button class="danger-outline">發現異常評論</button>
        </div>`;
      const [okBtn, flagBtn] = card.querySelectorAll('button');
      okBtn.addEventListener('click', () => check(it.platform, ''));
      flagBtn.addEventListener('click', () => openOverlay(it.platform));
    }
    listEl.appendChild(card);
  });
}

function openOverlay(platform) {
  activePlatform = platform;
  document.getElementById('overlayTitle').textContent = `回報異常評論・${platform}`;
  document.getElementById('overlayNote').value = '';
  document.getElementById('noteOverlay').style.display = 'flex';
}
function closeOverlay() {
  document.getElementById('noteOverlay').style.display = 'none';
  activePlatform = null;
}
async function submitWithNote() {
  const note = document.getElementById('overlayNote').value.trim();
  if (!note) { alert('請填說明'); return; }
  await check(activePlatform, note);
  closeOverlay();
}

async function check(platform, note) {
  await fetch(`${API}/api/review-checks/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch_id: staff.branch_id, work_date: today, platform, staff_id: staff.id, note }),
  });
  load();
}
