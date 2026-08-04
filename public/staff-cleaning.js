const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const monthStr = new Date().toISOString().slice(0, 7) + '-01';
document.getElementById('staffLine').textContent = `${staff.name}・${monthStr.slice(0, 7)}`;
document.getElementById('overlayCancel').addEventListener('click', closeOverlay);
document.getElementById('overlaySubmit').addEventListener('click', submitComplete);

let activeTemplateId = null;

load();
loadMyProgress();

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/staff-cleaning/list?branch_id=${staff.branch_id}&month=${monthStr}`);
  const items = await res.json();

  listEl.innerHTML = '';
  let lastCategory = null;
  items.forEach((it) => {
    if (it.category !== lastCategory) {
      const title = document.createElement('div');
      title.className = 'cat-title';
      title.textContent = `類別 ${it.category}`;
      listEl.appendChild(title);
      lastCategory = it.category;
    }

    const myCompletion = it.completions.find((c) => c.staff_id === staff.id);
    const isDoneByAnyone = it.completions.length > 0;
    const card = document.createElement('div');
    card.className = 'cleaning-card';

    const whoList = it.completions.length > 0
      ? `<div class="who-list">本月已完成：${it.completions.map((c) => c.staff?.name).join('、')}</div>`
      : '';

    if (isDoneByAnyone) {
      card.innerHTML = `<div class="card-row"><span class="card-title">${it.item_name}</span><span class="badge">${myCompletion ? '你已完成' : '本月已完成'}</span></div>${whoList}`;
    } else {
      card.innerHTML = `
        <div class="card-row"><span class="card-title">${it.item_name}</span></div>
        ${whoList}
        <div class="action-row" style="margin-top:8px;"><button class="btn">標記我完成了</button></div>`;
      card.querySelector('button').addEventListener('click', () => openOverlay(it.id, it.item_name));
    }
    listEl.appendChild(card);
  });
}

async function loadMyProgress() {
  const res = await fetch(`${API}/api/staff-cleaning/my-progress?branch_id=${staff.branch_id}&staff_id=${staff.id}&month=${monthStr}`);
  const data = await res.json();
  document.getElementById('myCount').textContent = data.count;
  document.getElementById('myCategories').textContent = data.categories.length;
}

function openOverlay(templateId, itemName) {
  activeTemplateId = templateId;
  document.getElementById('overlayTitle').textContent = `標記完成・${itemName}`;
  document.getElementById('photoInput').value = '';
  document.getElementById('photoOverlay').style.display = 'flex';
}
function closeOverlay() {
  document.getElementById('photoOverlay').style.display = 'none';
  activeTemplateId = null;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitComplete() {
  const fileInput = document.getElementById('photoInput');
  let photoDataUrl = null;
  if (fileInput.files[0]) photoDataUrl = await fileToDataUrl(fileInput.files[0]);

  await fetch(`${API}/api/staff-cleaning/${activeTemplateId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.id, month: monthStr, photo_url: photoDataUrl }),
  });
  closeOverlay();
  load();
  loadMyProgress();
}
