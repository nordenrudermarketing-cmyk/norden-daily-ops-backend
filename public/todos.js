// 「我的待辦」區塊：頁面上有 <div id="todosBox"></div> 就會自動畫出來（我的總覽、主管首頁、總辦公室儀表板共用）
// 資料來自 /api/home/todos（gas/Home.gs）：還沒做完的事（有期限、逾期標紅）和這個月已經做完的事
(function () {
  const box = document.getElementById('todosBox');
  const staff = JSON.parse(localStorage.getItem('staff') || 'null');
  if (!box || !staff) return;
  // 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
  const API = window.APP_CONFIG?.API_BASE_URL ?? '';

  const style = document.createElement('style');
  style.textContent = `
    .todo-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 12px; }
    .todo-card h2 { font-size: 15px; margin: 0 0 8px; }
    .todo-list { list-style: none; margin: 0; padding: 0; }
    .todo-list li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line); cursor: pointer; font-size: 14px; }
    .todo-list li:first-child { border-top: none; }
    .todo-list .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .todo-list li.late .dot { background: var(--danger); }
    .todo-list li.later .dot { background: #c9c4b8; }
    .todo-list li.done .dot { background: #c9c4b8; }
    .todo-list li.done { color: var(--ink-soft); font-size: 13px; }
    .todo-list .title { flex: 1; line-height: 1.5; }
    .todo-list .due { font-size: 12px; color: var(--ink-soft); white-space: nowrap; }
    .todo-list li.late .due { color: var(--danger); font-weight: 600; }
    .todo-list .go { color: var(--accent); font-size: 13px; }
    .todo-empty { font-size: 14px; color: var(--ink-soft); margin: 4px 0; }
  `;
  document.head.appendChild(style);

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;

  box.innerHTML = '<div class="todo-card"><h2>我的待辦</h2><p class="todo-empty">載入中…</p></div>';

  fetch(`${API}/api/home/todos`)
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.error || '待辦載入失敗');
      const todoRows = data.todos.map((t) => {
        const cls = t.overdue ? 'late' : t.upcoming ? 'later' : '';
        const due = t.due ? (t.overdue ? `已逾期（${md(t.due)} 前）` : t.upcoming ? '' : `${md(t.due)} 前`) : '';
        return `<li class="${cls}" data-url="${esc(t.url)}" data-month="${esc(t.month || '')}"><span class="dot"></span><span class="title">${esc(t.title)}</span><span class="due">${esc(due)}</span><span class="go">›</span></li>`;
      }).join('');
      const doneRows = data.done.map((t) =>
        `<li class="done" data-url="${esc(t.url)}" data-month="${esc(t.month || '')}"><span class="dot"></span><span class="title">✓ ${esc(t.title)}</span><span class="go">›</span></li>`).join('');
      box.innerHTML = `
        <div class="todo-card">
          <h2>我的待辦</h2>
          ${todoRows ? `<ul class="todo-list">${todoRows}</ul>` : '<p class="todo-empty">目前沒有要做的事 🎉</p>'}
        </div>
        ${doneRows ? `<div class="todo-card"><h2>這個月已完成</h2><ul class="todo-list">${doneRows}</ul></div>` : ''}`;
      box.querySelectorAll('[data-url]').forEach((li) => li.addEventListener('click', () => {
        // 要打開的月份（例如評核彙整）先記下來，該頁一進來會讀取
        if (li.dataset.month) {
          try { localStorage.setItem('appraisal_summary_month', li.dataset.month); } catch (e) { /* 存不了就看預設月份 */ }
        }
        window.location.href = li.dataset.url;
      }));
    })
    .catch((err) => {
      box.innerHTML = `<div class="todo-card"><h2>我的待辦</h2><p class="todo-empty">${esc(err.message)}</p></div>`;
    });
})();
