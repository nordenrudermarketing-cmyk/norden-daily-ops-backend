const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const STALE_THRESHOLD_DAYS = 7;

document.getElementById('staffLine').textContent = staff.name;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('staff');
  window.location.href = 'index.html';
});
document.getElementById('taskSubmit').addEventListener('click', submitTask);

let branchList = [];

init();

async function init() {
  await loadOverview();
  await loadTasks();
}

async function loadOverview() {
  const grid = document.getElementById('branchGrid');
  grid.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/hq/overview`);
  const overview = await res.json();
  branchList = overview.map((b) => ({ id: b.branch_id, name: b.branch_name }));

  const branchSelect = document.getElementById('taskBranch');
  branchSelect.innerHTML = branchList.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');

  grid.innerHTML = '';
  overview.forEach((b) => {
    const isStale = (b.oldest_anomaly_days ?? 0) >= STALE_THRESHOLD_DAYS || (b.oldest_defect_days ?? 0) >= STALE_THRESHOLD_DAYS;
    const card = document.createElement('div');
    card.className = 'branch-card' + (isStale ? ' stale' : '');

    card.innerHTML = `
      <h3>${b.branch_name}${isStale ? ' ⚠' : ''}</h3>
      <div class="metric-line"><span>今日房務完成</span><span class="val">${b.rooms_completed} / ${b.rooms_total}</span></div>
      <div class="metric-line"><span>未處理異常</span><span class="val ${b.unresolved_anomalies > 0 ? 'warn' : ''}">${b.unresolved_anomalies}${b.oldest_anomaly_days !== null ? `（最久 ${b.oldest_anomaly_days} 天）` : ''}</span></div>
      <div class="metric-line"><span>未處理缺失</span><span class="val ${b.unresolved_defects > 0 ? 'warn' : ''}">${b.unresolved_defects}${b.oldest_defect_days !== null ? `（最久 ${b.oldest_defect_days} 天）` : ''}</span></div>
      <div class="metric-line"><span>店經理巡館完成</span><span class="val">${b.manager_checklist_done} / 8</span></div>
      <div class="metric-line"><span>待處理總公司任務</span><span class="val ${b.pending_hq_tasks > 0 ? 'warn' : ''}">${b.pending_hq_tasks}</span></div>
      <p style="font-size:10.5px;color:var(--accent);margin:8px 0 0;">點卡片查看實際內容 ▾</p>
      <div class="branch-detail" style="display:none;"></div>
    `;

    let loaded = false;
    card.addEventListener('click', async (e) => {
      const detail = card.querySelector('.branch-detail');
      if (e.target.closest('button')) return; // 避免點到裡面的按鈕又觸發收合
      const showing = detail.style.display !== 'none';
      detail.style.display = showing ? 'none' : 'block';
      if (!showing && !loaded) {
        loaded = true;
        await loadBranchDetail(b.branch_id, detail);
      }
    });

    grid.appendChild(card);
  });
}

async function loadBranchDetail(branchId, container) {
  container.innerHTML = '<p class="empty-state" style="padding:10px 0;">載入中…</p>';

  const [anomaliesRes, defectsRes] = await Promise.all([
    fetch(`${API}/api/issues/anomalies?branch_id=${branchId}`).then((r) => r.json()),
    fetch(`${API}/api/issues/list?branch_id=${branchId}&resolved=false`).then((r) => r.json()),
  ]);

  let html = '';

  html += '<h4>系統偵測異常</h4>';
  if (anomalies_empty(anomaliesRes)) {
    html += '<p class="item" style="color:var(--ink-soft);">目前沒有</p>';
  } else {
    anomaliesRes.forEach((a) => {
      html += `<div class="item">
        ${a.description}
        <div class="meta">${new Date(a.detected_at).toLocaleDateString('zh-TW')}</div>
        <button data-resolve-anomaly="${a.id}">確認處理</button>
      </div>`;
    });
  }

  html += '<h4 style="margin-top:10px;">未處理缺失（最新10筆）</h4>';
  const topDefects = (defectsRes || []).slice(0, 10);
  if (topDefects.length === 0) {
    html += '<p class="item" style="color:var(--ink-soft);">目前沒有</p>';
  } else {
    topDefects.forEach((d) => {
      const sourceLabel = { room: '客房', public_area: '公共空間', deep_clean: '細清', shift_task: '客務班別任務' }[d.source_type] || d.source_type;
      html += `<div class="item">
        <strong>${sourceLabel}${d.location_label ? '・' + d.location_label : ''}</strong>　${d.description || ''}
        <div class="meta">${d.staff?.name || ''}・${new Date(d.reported_at).toLocaleString('zh-TW')}</div>
        <button data-resolve-defect="${d.id}">標記已處理</button>
      </div>`;
    });
  }

  container.innerHTML = html;

  container.querySelectorAll('[data-resolve-anomaly]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`${API}/api/issues/anomalies/${btn.dataset.resolveAnomaly}/resolve`, { method: 'POST' });
      loadBranchDetail(branchId, container);
      loadOverview();
    });
  });
  container.querySelectorAll('[data-resolve-defect]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`${API}/api/issues/${btn.dataset.resolveDefect}/resolve`, { method: 'POST' });
      loadBranchDetail(branchId, container);
      loadOverview();
    });
  });
}

function anomalies_empty(arr) {
  return !arr || arr.length === 0;
}

async function loadTasks() {
  const res = await fetch(`${API}/api/hq/tasks`);
  const tasks = await res.json();
  const body = document.querySelector('#taskTable tbody');

  if (tasks.length === 0) {
    body.innerHTML = '<tr><td colspan="5" style="color:var(--ink-soft);">還沒有交辦任務</td></tr>';
    return;
  }

  body.innerHTML = tasks.map((t) => `
    <tr>
      <td>${t.branches?.name || ''}</td>
      <td>${t.title}</td>
      <td>${t.due_date || '—'}</td>
      <td>${t.status === 'completed' ? '已完成' : '待處理'}</td>
      <td>${t.response_notes || ''}</td>
    </tr>`).join('');
}

async function submitTask() {
  const payload = {
    title: document.getElementById('taskTitle').value.trim(),
    description: document.getElementById('taskDesc').value,
    target_branch_id: document.getElementById('taskBranch').value,
    due_date: document.getElementById('taskDue').value || null,
    assigned_by: document.getElementById('taskAssignedBy').value,
  };
  if (!payload.title) { alert('請填標題'); return; }

  const res = await fetch(`${API}/api/hq/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert((await res.json()).error || '送出失敗'); return; }

  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskDue').value = '';
  loadTasks();
  loadOverview();
}
