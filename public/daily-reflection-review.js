const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('staffLine').textContent = staff.name;

const dateInput = document.getElementById('dateInput');
dateInput.value = new Date().toISOString().slice(0, 10);
dateInput.addEventListener('change', load);

load();

async function load() {
  const listEl = document.getElementById('refList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/reflections/daily/branch?branch_id=${staff.branch_id}&date=${dateInput.value}`);
  const items = await res.json();

  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty-state">這天還沒有人填每日自評。</p>';
    return;
  }

  listEl.innerHTML = '';
  items.forEach((it) => {
    const card = document.createElement('div');
    card.className = 'ref-card';
    card.innerHTML = `
      <div class="name">${it.staff?.name || ''}</div>
      <div class="qa"><b>完成工作：</b>${it.completed_tasks || '—'}</div>
      <div class="qa"><b>做得最好：</b>${it.best_task || '—'}</div>
      <div class="qa"><b>遇到問題：</b>${it.problems || '—'}</div>
      <div class="qa"><b>需要協助：</b>${it.needs_help || '—'}</div>
      <div class="qa"><b>明天改善：</b>${it.improve_tomorrow || '—'}</div>
    `;
    listEl.appendChild(card);
  });
}
