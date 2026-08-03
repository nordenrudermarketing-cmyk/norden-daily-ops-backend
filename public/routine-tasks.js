const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('staffLine').textContent = staff.name;

load();

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';
  const res = await fetch(`${API}/api/routine-tasks?branch_id=${staff.branch_id}&staff_id=${staff.id}`);
  const items = await res.json();

  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty-state">目前沒有分配給你的例行事項。</p>';
    return;
  }

  listEl.innerHTML = '';
  let lastCategory = null;
  items.forEach((it) => {
    if (it.category !== lastCategory) {
      const title = document.createElement('div');
      title.style.cssText = 'font-size:12px;font-weight:600;color:var(--ink-soft);margin:16px 0 8px;';
      title.textContent = it.category;
      listEl.appendChild(title);
      lastCategory = it.category;
    }

    const card = document.createElement('div');
    card.className = 'card' + (it.status === 'completed' ? ' done' : '');
    card.innerHTML = `
      <div class="card-row"><span class="card-title">${it.item_name}</span></div>
      ${it.week_note ? `<p class="card-meta">${it.week_note}</p>` : ''}
      ${it.due_date ? `<p class="card-meta">預計完成：${it.due_date}</p>` : ''}
      <textarea placeholder="進度說明" style="width:100%;margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-family:inherit;">${it.progress_note || ''}</textarea>
      <div class="action-row" style="margin-top:8px;">
        <select style="flex:1;padding:8px;border:1px solid var(--line);border-radius:8px;">
          <option value="pending" ${it.status === 'pending' ? 'selected' : ''}>待處理</option>
          <option value="in_progress" ${it.status === 'in_progress' ? 'selected' : ''}>進行中</option>
          <option value="completed" ${it.status === 'completed' ? 'selected' : ''}>已完成</option>
        </select>
        <button class="btn" style="flex:1;">儲存</button>
      </div>`;

    card.querySelector('button').addEventListener('click', () => saveProgress(it.id, card));
    listEl.appendChild(card);
  });
}

async function saveProgress(id, card) {
  const note = card.querySelector('textarea').value;
  const status = card.querySelector('select').value;
  await fetch(`${API}/api/routine-tasks/${id}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress_note: note, status }),
  });
  load();
}
