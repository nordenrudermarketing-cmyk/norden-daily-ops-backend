const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('staffLine').textContent = staff.name;
document.getElementById('overlayCancel').addEventListener('click', closeOverlay);
document.getElementById('overlaySubmit').addEventListener('click', submitComplete);

let activeAssignmentId = null;

load();

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/training/my-teaching?trainer_id=${staff.id}`);
  const items = await res.json();

  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty-state">目前沒有分配給你的教學任務。</p>';
    return;
  }

  listEl.innerHTML = '';
  let lastTrainee = null;
  items.forEach((it) => {
    if (it.trainee?.name !== lastTrainee) {
      const title = document.createElement('div');
      title.style.cssText = 'font-size:13px;font-weight:600;color:var(--ink-soft);margin:16px 0 8px;';
      title.textContent = `教學對象：${it.trainee?.name || ''}`;
      listEl.appendChild(title);
      lastTrainee = it.trainee?.name;
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-row"><span class="card-title">${it.unit?.item_name || ''}</span></div>
      <p class="card-meta">${it.unit?.category || ''}</p>
      <div class="action-row"><button class="btn">標記完成教學</button></div>`;
    card.querySelector('button').addEventListener('click', () => openOverlay(it.id, it.unit?.item_name));
    listEl.appendChild(card);
  });
}

function openOverlay(assignmentId, itemName) {
  activeAssignmentId = assignmentId;
  document.getElementById('overlayTitle').textContent = `標記完成教學・${itemName}`;
  document.getElementById('resultSelect').value = 'pass';
  document.getElementById('completeOverlay').style.display = 'flex';
}
function closeOverlay() {
  document.getElementById('completeOverlay').style.display = 'none';
  activeAssignmentId = null;
}

async function submitComplete() {
  await fetch(`${API}/api/training/teaching-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assignment_id: activeAssignmentId,
      trainer_id: staff.id,
      trainer_name: staff.name,
      result: document.getElementById('resultSelect').value,
    }),
  });
  closeOverlay();
  load();
}
