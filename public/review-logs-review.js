const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('staffLine').textContent = staff.name;
load();

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/review-checks/history?branch_id=${staff.branch_id}`);
  const logs = await res.json();

  if (logs.length === 0) { listEl.innerHTML = '<p class="empty-state">目前沒有評論回報紀錄。</p>'; return; }

  listEl.innerHTML = logs.map((l) => {
    const hasSpecial = !!l.special_report;
    return `
    <div class="log-card${hasSpecial ? ' has-special' : ''}">
      <div class="card-row"><span class="card-title">${l.work_date}</span><span class="card-meta">${l.staff?.name || ''}</span></div>
      <div class="platform-row">
        <span>BK：${l.bk_note || '—'}</span>
        <span>AG：${l.ag_note || '—'}</span>
        <span>Ctrip：${l.ctrip_note || '—'}</span>
        <span>Google：${l.google_note || '—'}</span>
      </div>
      ${hasSpecial ? `<div class="special-text">⚠ 特殊事項：${l.special_report}</div>` : ''}
    </div>`;
  }).join('');
}
