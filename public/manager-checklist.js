const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
document.getElementById('staffLine').textContent = `${staff.name}・${today}`;

loadTasks();

async function loadTasks() {
  const listEl = document.getElementById('taskList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  try {
    const res = await fetch(`${API}/api/manager-checklist/today?branch_id=${staff.branch_id}&date=${today}`);
    if (!res.ok) throw new Error('讀取失敗');
    renderTasks(await res.json());
  } catch (err) {
    listEl.innerHTML = `<p class="empty-state">讀取失敗：${err.message}</p>`;
  }
}

function renderTasks(tasks) {
  const listEl = document.getElementById('taskList');
  const done = tasks.filter((t) => t.completion?.status === 'completed').length;
  document.getElementById('sumDone').textContent = done;
  document.getElementById('sumRemaining').textContent = tasks.length - done;

  listEl.innerHTML = '';
  tasks.forEach((t) => {
    const isDone = t.completion?.status === 'completed';
    const card = document.createElement('div');
    card.className = 'card' + (isDone ? ' done' : '');

    if (isDone) {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${t.task_name}</span>
          <span class="card-meta">${new Date(t.completion.completed_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ${t.completion.notes ? `<p class="card-note" style="color:var(--ink-soft);">${t.completion.notes}</p>` : ''}`;
    } else {
      const noteId = `note-${t.id}`;
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${t.task_name}</span>
        </div>
        ${t.requires_note ? `<textarea id="${noteId}" placeholder="記錄內容">${t.suggested_note || ''}</textarea>` : ''}
        <div class="action-row">
          <button class="btn">標記完成</button>
        </div>`;
      card.querySelector('button').addEventListener('click', () => {
        const notes = t.requires_note ? document.getElementById(noteId).value : null;
        completeTask(t.id, notes);
      });
    }
    listEl.appendChild(card);
  });
}

async function completeTask(templateId, notes) {
  try {
    const res = await fetch(`${API}/api/manager-checklist/${templateId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staff.id, branch_id: staff.branch_id, work_date: today, notes }),
    });
    if (!res.ok) throw new Error('標記失敗');
    loadTasks();
  } catch (err) {
    alert(err.message);
  }
}
