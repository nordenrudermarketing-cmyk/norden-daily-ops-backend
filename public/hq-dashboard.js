const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const STALE_THRESHOLD_DAYS = 7;

document.getElementById('staffLine').textContent = staff.name;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('staff');
  window.location.href = 'index.html';
});
let disabledKeys = [];

init();

async function init() {
  // 被總公司關掉的區塊（各館營運總覽）直接藏起來，也不去打對應的 API
  // （原本的「總公司交辦任務」已改成左側選單的「待辦事項」）
  try {
    const res = await fetch(`${API}/api/features`);
    disabledKeys = (await res.json())?.disabled_keys || [];
  } catch (e) { /* 查不到就全部顯示 */ }

  const showOverview = !disabledKeys.includes('hq_overview');
  // .branch-grid 在 CSS 裡有 display:grid，hidden 屬性會被蓋掉，所以直接改 style
  document.getElementById('branchGrid').style.display = showOverview ? '' : 'none';
  document.getElementById('hqEmptyHint').style.display = showOverview ? 'none' : '';

  if (showOverview) await loadOverview();
}

async function loadOverview() {
  if (disabledKeys.includes('hq_overview')) return; // 處理完異常後也會呼叫這裡
  const grid = document.getElementById('branchGrid');
  grid.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/hq/overview`);
  const overview = await res.json();

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

  // 「異常處理」功能被總公司關掉時 API 會回 403（不是陣列），這裡一律當成沒有資料，
  // 才不會讓整個明細區塊掛掉
  const asList = (r) => r.json().then((d) => (Array.isArray(d) ? d : []));
  const [anomaliesRes, defectsRes] = await Promise.all([
    fetch(`${API}/api/issues/anomalies?branch_id=${branchId}`).then(asList),
    fetch(`${API}/api/issues/list?branch_id=${branchId}&resolved=false`).then(asList),
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
      const photoHtml = d.photo_url
        ? `<img src="${d.photo_url}" style="max-width:160px;max-height:160px;border-radius:8px;margin-top:6px;cursor:pointer;display:block;" onclick="window.open(this.src, '_blank')">`
        : '';
      html += `<div class="item">
        <strong>${sourceLabel}${d.location_label ? '・' + d.location_label : ''}</strong>　${d.description || ''}
        <div class="meta">${d.staff?.name || ''}・${new Date(d.reported_at).toLocaleString('zh-TW')}</div>
        ${photoHtml}
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
