const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const weekInput = document.getElementById('weekInput');
weekInput.value = new Date().toISOString().slice(0, 10);
weekInput.addEventListener('change', load);

load();

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const weekStart = mondayOf(weekInput.value);
  const res = await fetch(`${API}/api/manager-memo/weekly-report?week_start=${weekStart}`);
  const branches = await res.json();

  listEl.innerHTML = `<p style="font-size:12px;color:var(--ink-soft);margin-bottom:12px;">本週：${weekStart} 起七天</p>` +
    branches.map((b) => `
      <div class="branch-block">
        <p style="font-weight:600;font-size:15px;margin:0 0 4px;">${b.branch_name}</p>
        <div class="count-row">
          <div class="count-pill"><div class="num" style="color:var(--danger);">${b.counts.todo || 0}</div><div>待辦</div></div>
          <div class="count-pill"><div class="num" style="color:#8a6d00;">${b.counts.in_progress || 0}</div><div>追蹤中</div></div>
          <div class="count-pill"><div class="num" style="color:var(--accent);">${b.counts.done || 0}</div><div>已完成</div></div>
        </div>
        ${b.items.length === 0 ? '<p class="empty-state">這週沒有紀錄。</p>' :
          b.items.map((it) => `<div class="item-line">[${{ todo: '待辦', in_progress: '追蹤中', done: '已完成' }[it.status]}] ${it.content}</div>`).join('')}
      </div>`).join('');
}
