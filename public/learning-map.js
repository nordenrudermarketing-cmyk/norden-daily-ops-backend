const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CATEGORY_MAP = { housekeeping: 'housekeeping', frontdesk: 'frontdesk' };
const STAGES = ['認識', '操作', '獨立', '穩定'];

document.getElementById('staffLine').textContent = staff.name;

load();

async function load() {
  const category = CATEGORY_MAP[staff.roles?.category];
  if (!category) {
    document.getElementById('unitsList').innerHTML = '<p class="empty-state">你的職務目前沒有對應的學習地圖。</p>';
    return;
  }

  const res = await fetch(`${API}/api/training/progress?staff_id=${staff.id}&category=${category}&branch_id=${staff.branch_id}`);
  const data = await res.json();
  renderUnits(data.units || []);

  if (category === 'housekeeping') loadStages();
}

function renderUnits(units) {
  const listEl = document.getElementById('unitsList');
  if (units.length === 0) {
    listEl.innerHTML = '<p class="empty-state">目前沒有指派任何學習項目給你，請聯繫店經理。</p>';
    document.getElementById('progressSummary').style.display = 'none';
    return;
  }

  const passCount = units.filter((u) => u.progress?.result === 'pass').length;
  document.getElementById('progressSummary').style.display = 'flex';
  document.getElementById('progressPass').textContent = passCount;
  document.getElementById('progressTotal').textContent = units.length;
  document.getElementById('progressBig').textContent = `${Math.round((passCount / units.length) * 100)}%`;

  listEl.innerHTML = '';
  let lastTopic = null;
  let lastCategory = null;

  units.forEach((u) => {
    if (u.topic && u.topic !== lastTopic) {
      const topicEl = document.createElement('div');
      topicEl.className = 'unit-topic-title';
      topicEl.textContent = u.topic;
      listEl.appendChild(topicEl);
      lastTopic = u.topic;
      lastCategory = null;
    }
    if (u.category !== lastCategory) {
      const catEl = document.createElement('div');
      catEl.className = 'unit-group-title';
      catEl.textContent = u.category;
      listEl.appendChild(catEl);
      lastCategory = u.category;
    }

    const result = u.progress?.result;
    const row = document.createElement('div');
    row.className = 'unit-row' + (result === 'pass' ? ' pass' : result === 'fail' ? ' fail' : '');

    let statusText;
    if (result === 'pass') statusText = `✓ 已合格・培訓員：${u.progress.trainer_name || ''}・${u.progress.taught_date || ''}`;
    else if (result === 'fail') statusText = `需要重新學習・培訓員：${u.progress.trainer_name || ''}・${u.progress.taught_date || ''}`;
    else statusText = '尚未教學';

    row.innerHTML = `
      <p class="unit-name">${u.item_name}</p>
      ${u.item_name_id ? `<p class="unit-name" style="font-size:11px;color:var(--ink-soft);margin-top:2px;">${u.item_name_id}</p>` : ''}
      <p class="unit-status">${statusText}</p>`;
    listEl.appendChild(row);
  });
}

async function loadStages() {
  const res = await fetch(`${API}/api/assessment/stages?staff_id=${staff.id}`);
  const stages = await res.json();

  document.getElementById('stageTitle').style.display = 'block';
  const el = document.getElementById('stageStepper');
  el.innerHTML = STAGES.map((stage) => {
    const info = stages.find((s) => s.stage === stage);
    const passed = info?.result === 'pass';
    const statusText = info?.result === 'pass' ? '已通過' : info?.result === 'not_yet' ? '未通過' : '尚未評核';
    return `<div class="stage-pill${passed ? ' pass' : ''}"><div>${stage}</div><div class="stage-status">${statusText}</div></div>`;
  }).join('');
}
