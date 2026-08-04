const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('staffLine').textContent = staff.name;

const SOURCE_LABEL = { room: '客房', public_area: '公共空間', deep_clean: '細清', shift_task: '客務班別任務' };

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('listTab').style.display = tab === 'list' ? 'block' : 'none';
    document.getElementById('trendTab').style.display = tab === 'trend' ? 'block' : 'none';
    if (tab === 'trend') loadTrends();
  });
});

document.getElementById('resolvedFilter').addEventListener('change', loadList);
document.getElementById('sourceFilter').addEventListener('change', loadList);
document.getElementById('daysFilter').addEventListener('change', loadTrends);

loadList();

async function loadList() {
  const listEl = document.getElementById('issueList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const resolved = document.getElementById('resolvedFilter').value;
  const sourceType = document.getElementById('sourceFilter').value;

  let url = `${API}/api/issues/list?branch_id=${staff.branch_id}`;
  if (resolved !== '') url += `&resolved=${resolved}`;
  if (sourceType) url += `&source_type=${sourceType}`;

  const res = await fetch(url);
  const issues = await res.json();

  if (issues.length === 0) {
    listEl.innerHTML = '<p class="empty-state">沒有符合條件的紀錄。</p>';
    return;
  }

  listEl.innerHTML = '';
  issues.forEach((i) => {
    const card = document.createElement('div');
    card.className = 'card' + (i.resolved ? ' done' : '');
    const label = SOURCE_LABEL[i.source_type] || i.source_type;
    const locationText = i.location_label ? `・${i.location_label}` : '';
    const photoHtml = i.photo_url
      ? `<img src="${i.photo_url}" style="max-width:180px;max-height:180px;border-radius:8px;margin-top:6px;cursor:pointer;display:block;" onclick="window.open(this.src, '_blank')">`
      : '';

    card.innerHTML = `
      <div class="card-row">
        <span class="badge">${label}${locationText}</span>
        <span class="card-meta">${i.staff?.name || ''}・${new Date(i.reported_at).toLocaleString('zh-TW')}</span>
      </div>
      <p class="card-note" style="color:var(--ink);">${i.description || ''}</p>
      ${photoHtml}`;

    if (!i.resolved) {
      const actionRow = document.createElement('div');
      actionRow.className = 'action-row';
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = '標記已處理';
      btn.addEventListener('click', () => resolveIssue(i.id));
      actionRow.appendChild(btn);
      card.appendChild(actionRow);
    }
    listEl.appendChild(card);
  });
}

async function resolveIssue(id) {
  await fetch(`${API}/api/issues/${id}/resolve`, { method: 'POST' });
  loadList();
}

async function loadTrends() {
  const listEl = document.getElementById('trendList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const days = document.getElementById('daysFilter').value;
  const res = await fetch(`${API}/api/issues/room-trends?branch_id=${staff.branch_id}&days=${days}`);
  const trends = await res.json();

  if (trends.length === 0) {
    listEl.innerHTML = '<p class="empty-state">這段期間沒有客房異常回報紀錄。</p>';
    return;
  }

  listEl.innerHTML = '';
  trends.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'trend-card' + (t.count >= 3 ? ' high' : '');
    card.innerHTML = `
      <div class="card-row">
        <span class="card-title">${t.room_number}</span>
        <span class="trend-count">${t.count} 次</span>
      </div>
      ${t.items.slice(0, 5).map((it) => `<p class="trend-item">・${new Date(it.reported_at).toLocaleDateString('zh-TW')}：${it.description}</p>`).join('')}`;
    listEl.appendChild(card);
  });
}
