const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

// 這頁只有總公司能用
if (staff && staff.roles?.name !== '總公司') {
  alert('這個頁面只有總公司帳號可以使用');
  window.location.href = 'index.html';
}

const MODE_TEXT = {
  all: '目前狀態：<strong>全部功能開啟</strong>——系統所有功能都可以正常使用。',
  self_eval_only: '目前狀態：<strong>只開放自評表</strong>——除了每月自評表與總公司後台之外，其他功能全部隱藏中。',
  custom: '目前狀態：<strong>自訂</strong>——部分功能已關閉，詳細請看下方清單。',
};

const listEl = document.getElementById('featureList');
const bannerEl = document.getElementById('modeBanner');
const statusEl = document.getElementById('statusLine');

document.getElementById('staffLine').textContent = staff?.name || '';
document.getElementById('presetSelfEvalOnly').addEventListener('click', () => {
  if (!confirm('確定要關閉「自評表以外的所有功能」嗎？\n全公司所有同仁都會馬上看不到那些功能。')) return;
  applyPreset('self-eval-only');
});
document.getElementById('presetEnableAll').addEventListener('click', () => {
  if (!confirm('確定要把所有功能都開啟嗎？')) return;
  applyPreset('enable-all');
});

load();

async function load() {
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';
  try {
    const res = await fetch(`${API}/api/features`);
    if (!res.ok) throw new Error((await res.json()).error || '載入失敗');
    render(await res.json());
  } catch (err) {
    listEl.innerHTML = '';
    setStatus(err.message, true);
  }
}

function render(data) {
  bannerEl.className = `mode-banner ${data.mode}`;
  bannerEl.innerHTML = MODE_TEXT[data.mode] || MODE_TEXT.custom;

  const groups = [];
  data.features.forEach((f) => {
    let g = groups.find((x) => x.name === f.group);
    if (!g) { g = { name: f.group, items: [] }; groups.push(g); }
    g.items.push(f);
  });

  listEl.innerHTML = '';
  groups.forEach((group) => {
    const title = document.createElement('p');
    title.className = 'group-title';
    title.textContent = group.name;
    listEl.appendChild(title);

    group.items.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'feature-row' + (f.enabled ? '' : ' off');
      row.innerHTML = `
        <div class="info">
          <div class="name">${f.label}${f.locked ? '<span class="lock-badge">保留・不可關閉</span>' : ''}</div>
          <div class="desc">${f.description || ''}</div>
          ${f.pages.length ? `<div class="pages">頁面：${f.pages.join('、')}</div>` : ''}
        </div>
        <label class="switch">
          <input type="checkbox" ${f.enabled ? 'checked' : ''} ${f.locked ? 'disabled' : ''}>
          <span class="track"></span>
        </label>`;

      const input = row.querySelector('input');
      if (!f.locked) {
        input.addEventListener('change', () => toggle(f, input));
      }
      listEl.appendChild(row);
    });
  });
}

async function toggle(feature, input) {
  const enabled = input.checked;
  input.disabled = true;
  setStatus('儲存中…');

  try {
    const res = await fetch(`${API}/api/features/${feature.key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, updated_by: staff?.name || null }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '儲存失敗');
    render(await res.json());
    setStatus(`已${enabled ? '開啟' : '關閉'}「${feature.label}」`);
  } catch (err) {
    input.checked = !enabled;
    setStatus(err.message, true);
  } finally {
    input.disabled = false;
  }
}

async function applyPreset(name) {
  setStatus('儲存中…');
  try {
    const res = await fetch(`${API}/api/features/preset/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updated_by: staff?.name || null }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '儲存失敗');
    render(await res.json());
    setStatus(name === 'self-eval-only' ? '已切換為「只開放自評表」' : '已把所有功能開啟');
  } catch (err) {
    setStatus(err.message, true);
  }
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = 'status-line' + (isError ? ' err' : '');
}
