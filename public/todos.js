// 待辦事項追蹤
//   「我派發的任務」：副理以上才有，看得到同一個派發館別（總公司／本館）派出去的任務
//   「我的任務」：執行人是自己的任務
// 權限由後端 /api/todos 依資料庫裡的真實職務判斷，這裡只負責畫面

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const $ = (id) => document.getElementById(id);

const KIND_LABEL = {
  progress: '進度', assign: '更換執行人', hold: '暫緩', resume: '恢復執行',
  submit: '完成待檢查', close: '檢核結案', reject: '退回',
};

let meta = { can_dispatch: false, assignees: [], today: '', done_limit: 50 };
let currentTab = 'mine';
let tasks = [];
const expanded = new Set(); // 展開進度紀錄的任務，重新載入後維持展開

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 所有請求都帶上 actor_id，後端用它查「現在是誰在操作」
async function api(path, method = 'GET', body) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}/api/todos${path}${sep}actor_id=${encodeURIComponent(staff.id)}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '操作失敗，請稍後再試');
  return data;
}

function setStatus(text, isError = false) {
  $('statusLine').textContent = text;
  $('statusLine').className = 'status-line' + (isError ? ' err' : '');
}

// '2026-09-25' → '9/25'
function shortDate(value) {
  if (!value) return '';
  const [, m, d] = value.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}`;
}

if (staff) init();

async function init() {
  $('staffLine').textContent = staff.name;
  try {
    meta = await api('/meta');
  } catch (err) {
    $('board').innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (meta.can_dispatch) {
    $('tabDispatched').style.display = '';
    currentTab = 'dispatched';
  }
  // 從網址 #mine／#dispatched 或上次停留的分頁開啟
  let saved = window.location.hash.slice(1);
  if (!saved) {
    try { saved = localStorage.getItem('todos.tab') || ''; } catch (e) { saved = ''; }
  }
  if (saved === 'mine' || (saved === 'dispatched' && meta.can_dispatch)) currentTab = saved;

  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  $('nAssignee').innerHTML = assigneeOptions();
  $('newBtn').addEventListener('click', () => {
    $('newForm').style.display = '';
    $('newBtn').style.display = 'none';
    $('nTitle').focus();
  });
  $('newCancel').addEventListener('click', closeNewForm);
  $('newForm').addEventListener('submit', createTask);

  switchTab(currentTab);
}

function assigneeOptions(selectedId) {
  const opts = meta.assignees.map((a) => {
    const label = `${a.name}（${[a.branch_name, a.role_name].filter(Boolean).join('・')}）`;
    return `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  });
  return '<option value="">請選擇</option>' + opts.join('');
}

function switchTab(tab) {
  currentTab = tab;
  try { localStorage.setItem('todos.tab', tab); } catch (e) { /* 存不了就算了 */ }
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('newWrap').style.display = tab === 'dispatched' && meta.can_dispatch ? '' : 'none';
  setStatus('');
  tasks = []; // 換分頁時先清掉，避免看到上一個分頁的任務
  load();
}

async function load() {
  const board = $('board');
  if (tasks.length === 0) board.innerHTML = '<p class="empty-state">載入中…</p>';
  try {
    tasks = await api(currentTab === 'dispatched' ? '/dispatched' : '/mine');
  } catch (err) {
    board.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    tasks = [];
    return;
  }
  render();
}

function render() {
  const active = tasks.filter((t) => t.status === 'in_progress' || t.status === 'pending_review');
  const onHold = tasks.filter((t) => t.status === 'on_hold');
  const done = tasks.filter((t) => t.status === 'done');
  // 待檢核的排前面，其他照派發時間（新的在前）
  active.sort((a, b) => Number(b.status === 'pending_review') - Number(a.status === 'pending_review'));

  const board = $('board');
  board.innerHTML = '';
  board.appendChild(section('正在執行', active, true,
    currentTab === 'dispatched' ? '執行人按「完成待檢查」之後，才能按「檢核結案」' : ''));
  board.appendChild(section('暫緩執行', onHold, onHold.length > 0));
  board.appendChild(section('已完成', done, false,
    done.length >= meta.done_limit ? `只顯示最近 ${meta.done_limit} 筆` : ''));
}

function section(title, list, open, hint = '') {
  const el = document.createElement('details');
  el.className = 'section';
  el.open = open;
  el.innerHTML = `<summary>${title}（${list.length}）</summary>${hint ? `<p class="section-hint">${escapeHtml(hint)}</p>` : ''}`;
  if (list.length === 0) {
    el.insertAdjacentHTML('beforeend', '<p class="empty-state" style="padding:10px 0;">目前沒有</p>');
  }
  list.forEach((t) => el.appendChild(taskCard(t)));
  return el;
}

function taskCard(t) {
  const card = document.createElement('div');
  card.className = 'task-card' + (t.status === 'pending_review' ? ' review' : '') + (t.status === 'done' ? ' done' : '');

  const overdue = t.due_date && t.status !== 'done' && meta.today && t.due_date < meta.today;
  const tags = [
    t.status === 'pending_review' ? '<span class="tag review">待檢核</span>' : '',
    overdue ? '<span class="tag overdue">已逾期</span>' : '',
  ].join('');

  const who = `派發：${escapeHtml(t.creator_name || '—')} → 執行：${escapeHtml(t.assignee_name || '—')}` +
    (t.assignee_branch_name && t.assignee_branch_name !== t.owner_branch_name ? `（${escapeHtml(t.assignee_branch_name)}）` : '');
  const metaBits = [
    who,
    t.due_date ? `期限 ${escapeHtml(t.due_date)}` : '',
    t.last_update_date ? `最近進度 ${shortDate(t.last_update_date)}` : '',
    t.status === 'done' && t.closed_at ? `${escapeHtml(t.closer_name || '')} ${new Date(t.closed_at).toLocaleDateString('zh-TW')} 結案` : '',
  ].filter(Boolean).join('・');

  const isOpen = expanded.has(t.id);
  card.innerHTML = `
    <div class="task-head">
      <button class="toggle ${isOpen ? 'open' : ''}" aria-label="展開進度紀錄" aria-expanded="${isOpen}">▸</button>
      <div class="task-main">
        <p class="task-title">${escapeHtml(t.title)}${tags}</p>
        <p class="task-meta">${metaBits}</p>
        ${t.description ? `<p class="task-desc">${escapeHtml(t.description)}</p>` : ''}
      </div>
    </div>
    <div class="task-actions"></div>
    <div class="form-slot"></div>
    <div class="task-log" style="display:${isOpen ? '' : 'none'};">${logHtml(t)}</div>`;

  const toggle = card.querySelector('.toggle');
  toggle.addEventListener('click', () => {
    const log = card.querySelector('.task-log');
    const nowOpen = log.style.display === 'none';
    log.style.display = nowOpen ? '' : 'none';
    toggle.classList.toggle('open', nowOpen);
    toggle.setAttribute('aria-expanded', String(nowOpen));
    if (nowOpen) expanded.add(t.id); else expanded.delete(t.id);
  });

  renderActions(card, t);
  return card;
}

function logHtml(t) {
  if (!t.updates || t.updates.length === 0) {
    return '<p class="log-item" style="color:var(--ink-soft);">還沒有進度紀錄</p>';
  }
  return t.updates.map((u) => `
    <div class="log-item">
      <span class="log-date">${escapeHtml(u.update_date)}・${escapeHtml(u.author_name || '')}</span>
      ${u.kind !== 'progress' ? `<span class="log-kind">${escapeHtml(KIND_LABEL[u.kind] || u.kind)}</span>` : ''}
      <div class="log-note">${escapeHtml(u.note)}</div>
    </div>`).join('');
}

function button(label, onClick, { main = false, disabled = false, title = '' } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (main) b.className = 'main';
  if (disabled) b.disabled = true;
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

function waiting(text) {
  const s = document.createElement('span');
  s.className = 'waiting';
  s.textContent = text;
  return s;
}

function renderActions(card, t) {
  const box = card.querySelector('.task-actions');
  const add = (el) => box.appendChild(el);
  const progress = () => showForm(card, progressForm(t));

  if (t.status === 'done') {
    box.remove();
    return;
  }

  if (currentTab === 'dispatched' && t.can_manage) {
    if (t.status === 'on_hold') {
      add(button('恢復執行', () => doAction(t, 'resume', '已恢復執行').catch(() => {}), { main: true }));
      add(button('更新進度', progress));
    } else {
      add(button('更新進度', progress));
      add(button('暫緩執行', () => showForm(card, noteForm({
        label: '暫緩原因（選填）', submitLabel: '移到暫緩執行',
        onSubmit: (note) => doAction(t, 'hold', '已移到暫緩執行', { note }),
      }))));
      const reviewable = t.status === 'pending_review';
      add(button('檢核結案', () => {
        if (confirm(`確定「${t.title}」已經完成、要結案嗎？`)) doAction(t, 'close', '已檢核結案').catch(() => {});
      }, { main: reviewable, disabled: !reviewable, title: reviewable ? '' : '要等執行人按「完成待檢查」之後才能結案' }));
      if (reviewable) {
        add(button('退回', () => showForm(card, noteForm({
          label: '退回原因（執行人會看到）', submitLabel: '退回給執行人', required: true,
          onSubmit: (note) => doAction(t, 'reject', '已退回給執行人', { note }),
        }))));
      }
    }
    add(button('更換執行人', () => showForm(card, reassignForm(t))));
    return;
  }

  // 我的任務
  if (t.status === 'in_progress') {
    add(button('更新進度', progress));
    add(button('完成待檢查', () => showForm(card, noteForm({
      label: '完成說明（選填）', submitLabel: '送出，請主管檢查',
      onSubmit: (note) => doAction(t, 'submit', '已送出，等待主管檢核', { note }),
    })), { main: true }));
  } else if (t.status === 'pending_review') {
    add(button('更新進度', progress));
    add(waiting('已送出，等待主管檢核'));
  } else if (t.status === 'on_hold') {
    add(waiting('主管已暫緩這個任務'));
  }
}

// ---------- 卡片裡的小表單（一次只開一個） ----------

function showForm(card, { html, onSubmit, focus, submitLabel = '確定' }) {
  document.querySelectorAll('.form-slot').forEach((slot) => { slot.innerHTML = ''; });
  const slot = card.querySelector('.form-slot');
  slot.innerHTML = `
    <form class="inline-form">
      ${html}
      <div class="form-actions">
        <button type="button" class="cancel">取消</button>
        <button type="submit" class="ok">${escapeHtml(submitLabel)}</button>
      </div>
      <p class="form-error"></p>
    </form>`;
  const form = slot.querySelector('form');
  const errEl = form.querySelector('.form-error');
  const okBtn = form.querySelector('.ok');
  form.querySelector('.cancel').addEventListener('click', () => { slot.innerHTML = ''; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    okBtn.disabled = true;
    try {
      await onSubmit(form);
    } catch (err) {
      errEl.textContent = err.message;
      okBtn.disabled = false;
    }
  });
  const target = focus ? form.querySelector(focus) : form.querySelector('textarea, select, input');
  if (target) target.focus();
  return form;
}

function progressForm(t) {
  return {
    html: `
      <div class="field"><label>日期</label><input type="date" name="date" value="${escapeHtml(meta.today)}" required></div>
      <div class="field"><label>進度簡述</label><textarea name="note" placeholder="今天做了什麼、卡在哪裡"></textarea></div>`,
    focus: 'textarea',
    submitLabel: '送出進度',
    onSubmit: async (form) => {
      const note = form.note.value.trim();
      if (!note) throw new Error('請填寫進度簡述');
      await api(`/${t.id}/updates`, 'POST', { update_date: form.date.value, note });
      expanded.add(t.id); // 更新完直接展開，看得到剛寫的那筆
      setStatus(`已更新「${t.title}」的進度`);
      await load();
    },
  };
}

function noteForm({ label, submitLabel, required = false, onSubmit }) {
  return {
    html: `<div class="field"><label>${escapeHtml(label)}</label><textarea name="note"></textarea></div>`,
    submitLabel,
    onSubmit: async (form) => {
      const note = form.note.value.trim();
      if (required && !note) throw new Error(`請填寫${label.replace(/（.*）/, '')}`);
      await onSubmit(note);
    },
  };
}

function reassignForm(t) {
  return {
    html: `<div class="field"><label>新的執行人</label><select name="assignee">${assigneeOptions(t.assignee_id)}</select></div>`,
    submitLabel: '確定更換',
    onSubmit: async (form) => {
      const assigneeId = form.assignee.value;
      if (!assigneeId) throw new Error('請選擇執行人');
      if (assigneeId === t.assignee_id) throw new Error('執行人沒有變動');
      await api(`/${t.id}/assignee`, 'PUT', { assignee_id: assigneeId });
      setStatus(`已更換「${t.title}」的執行人`);
      await load();
    },
  };
}

// 狀態變更（暫緩、恢復、完成待檢查、結案、退回）
// 失敗時狀態列顯示錯誤，並把錯誤往上丟給小表單；直接從按鈕呼叫的要自己 .catch
async function doAction(t, action, doneText, body = {}) {
  try {
    await api(`/${t.id}/${action}`, 'POST', body);
    setStatus(`「${t.title}」${doneText}`);
    await load();
  } catch (err) {
    setStatus(err.message, true);
    throw err; // 從小表單呼叫時，讓表單顯示錯誤
  }
}

// ---------- 派發新任務 ----------

function closeNewForm() {
  $('newForm').reset();
  $('newForm').style.display = 'none';
  $('newBtn').style.display = '';
  $('newError').textContent = '';
}

async function createTask(event) {
  event.preventDefault();
  const body = {
    title: $('nTitle').value.trim(),
    description: $('nDesc').value.trim(),
    assignee_id: $('nAssignee').value,
    due_date: $('nDue').value || null,
  };
  if (!body.title) { $('newError').textContent = '請填寫任務名稱'; return; }
  if (!body.assignee_id) { $('newError').textContent = '請選擇執行人'; return; }

  $('newError').textContent = '派發中…';
  try {
    const task = await api('', 'POST', body);
    closeNewForm();
    setStatus(`已派發「${task.title}」給 ${task.assignee_name || ''}`);
    await load();
  } catch (err) {
    $('newError').textContent = err.message;
  }
}
