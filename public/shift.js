const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
const roleName = staff.roles?.name || '';
const shiftCode = staff.todayShiftCode;
if (!shiftCode) { window.location.href = 'unscheduled.html'; }

document.getElementById('staffLine').textContent = `${staff.name}・${roleName}・${today}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('staff');
  window.location.href = 'index.html';
});

if (shiftCode === 'C' || shiftCode === 'B') {
  document.getElementById('linkRow').innerHTML =
    '<a href="inspect.html" style="font-size:12px;color:var(--accent);">前往巡房檢查 →</a>';
}

document.getElementById('reportCancel').addEventListener('click', closeReportOverlay);
document.getElementById('reportSubmit').addEventListener('click', submitReport);
let activeReportTask = null;
let activeReportTaskId = null;

loadTasks();

async function loadTasks() {
  const listEl = document.getElementById('taskList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  try {
    const res = await fetch(`${API}/api/shift-tasks/today?branch_id=${staff.branch_id}&shift_code=${shiftCode}&date=${today}`);
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

  if (tasks.length === 0) {
    listEl.innerHTML = '<p class="empty-state">今天沒有排定的任務。</p>';
    return;
  }

  listEl.innerHTML = '';
  tasks.forEach((t) => {
    const isDone = t.completion?.status === 'completed';
    const card = document.createElement('div');
    card.className = 'card' + (isDone ? ' done' : '');

    // 已回報的異常（不分是哪位同班同仁報的，大家都看得到，避免重複回報同一件事）
    const reportsHtml = (t.reports && t.reports.length > 0)
      ? t.reports.map((r) => `<p class="card-note">已回報：${r.description}（${r.staff?.name || ''}）</p>`).join('')
      : '';

    if (isDone) {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${t.task_name}</span>
          <span class="card-meta">${t.completion.staff?.name || ''}・${new Date(t.completion.completed_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ${reportsHtml}
        <div class="action-row">
          <button class="danger-outline">回報異常</button>
        </div>`;
      card.querySelector('button').addEventListener('click', () => openReportOverlay(t.id, t.task_name));
    } else {
      card.innerHTML = `
        <div class="card-row">
          <span class="card-title">${t.task_name}</span>
        </div>
        ${reportsHtml}
        <div class="action-row">
          <button class="btn">標記完成</button>
          <button class="danger-outline">回報異常</button>
        </div>`;
      const [doneBtn, reportBtn] = card.querySelectorAll('button');
      doneBtn.addEventListener('click', () => completeTask(t.id));
      reportBtn.addEventListener('click', () => openReportOverlay(t.id, t.task_name));
    }
    listEl.appendChild(card);
  });
}

function openReportOverlay(taskId, taskName) {
  activeReportTaskId = taskId;
  activeReportTask = taskName;
  document.getElementById('reportTaskTitle').textContent = `回報異常・${taskName}`;
  document.getElementById('reportNote').value = '';
  document.getElementById('reportPhoto').value = '';
  document.getElementById('reportOverlay').style.display = 'flex';
}

function closeReportOverlay() {
  document.getElementById('reportOverlay').style.display = 'none';
  activeReportTaskId = null;
  activeReportTask = null;
}

async function submitReport() {
  const note = document.getElementById('reportNote').value.trim();
  if (!note) { alert('請填寫問題說明'); return; }

  const fileInput = document.getElementById('reportPhoto');
  let photoDataUrl = null;
  if (fileInput.files[0]) photoDataUrl = await fileToDataUrl(fileInput.files[0]);

  try {
    const res = await fetch(`${API}/api/issues/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: staff.branch_id,
        source_type: 'shift_task',
        source_id: activeReportTaskId,
        source_label: activeReportTask,
        reported_by: staff.id,
        description: note,
        photo_url: photoDataUrl,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '送出失敗');
    closeReportOverlay();
    alert('已回報，會自動出現在今日交班表的異常回報欄位');
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

async function completeTask(templateId) {
  try {
    const res = await fetch(`${API}/api/shift-tasks/${templateId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staff.id, work_date: today }),
    });
    if (!res.ok) throw new Error('標記失敗');
    loadTasks();
  } catch (err) {
    alert(err.message);
  }
}
