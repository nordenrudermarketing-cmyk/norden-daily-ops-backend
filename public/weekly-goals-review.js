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

const weekStart = mondayOf(new Date());
document.getElementById('staffLine').textContent = `${staff.name}・本週（${weekStart} 起）`;

load();

async function load() {
  const listEl = document.getElementById('goalList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/reflections/weekly/branch?branch_id=${staff.branch_id}&week_start=${weekStart}`);
  const items = await res.json();

  listEl.innerHTML = '';
  items.forEach((it) => {
    const status = it.goal?.status || 'none';
    const card = document.createElement('div');
    card.className = 'goal-card';

    if (!it.goal) {
      card.innerHTML = `
        <div class="top-row"><span class="name">${it.name}</span><span class="status-badge none">尚未填寫</span></div>`;
    } else {
      card.innerHTML = `
        <div class="top-row">
          <span class="name">${it.name}</span>
          <span class="status-badge ${status}">${status === 'confirmed' ? '已確認' : '待確認'}</span>
        </div>
        <div class="qa"><b>本週目標：</b>${it.goal.main_goals || '—'}</div>
        <div class="qa"><b>品質要求：</b>${it.goal.quality_requirements || '—'}</div>
        <div class="qa"><b>已完成：</b>${it.goal.completed_items || '—'}</div>
        <div class="qa"><b>尚未完成：</b>${it.goal.pending_items || '—'}</div>
        <div class="qa"><b>需要協助：</b>${it.goal.needs_help || '—'}</div>
        <div class="qa"><b>下週重點：</b>${it.goal.next_week_focus || '—'}</div>
      `;
      if (status !== 'confirmed') {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.marginTop = '8px';
        btn.textContent = '確認本週目標';
        btn.addEventListener('click', () => confirmGoal(it.goal.id));
        card.appendChild(btn);
      }
    }
    listEl.appendChild(card);
  });
}

async function confirmGoal(goalId) {
  await fetch(`${API}/api/reflections/weekly/${goalId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed_by: staff.id }),
  });
  load();
}
