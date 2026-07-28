const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const categorySelect = document.getElementById('categorySelect');
const staffSelect = document.getElementById('staffSelect');

categorySelect.addEventListener('change', () => { loadStaffOptions(); });
staffSelect.addEventListener('change', loadProgress);
document.getElementById('examSubmit').addEventListener('click', submitExam);

init();

async function init() {
  // 預設選自己所屬的類別（如果對得上）
  const myCategory = staff.roles?.category;
  if (myCategory === 'housekeeping' || myCategory === 'frontdesk') categorySelect.value = myCategory;
  await loadStaffOptions();
}

async function loadStaffOptions() {
  const category = categorySelect.value;
  const res = await fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}&category=${category}`);
  const staffList = await res.json();

  staffSelect.innerHTML = staffList.map((s) => `<option value="${s.id}" ${s.id === staff.id ? 'selected' : ''}>${s.name}</option>`).join('');
  document.getElementById('examSection').style.display = category === 'housekeeping' ? 'block' : 'none';
  loadProgress();
}

const CATEGORIES = ['工作態度', '專業能力', '工作品質', '工作效率', '溝通能力', '團隊合作', '主動性', '責任感', '問題處理', '品牌認同'];
const STAGES = ['認識', '操作', '獨立', '穩定'];
let selectedStage = null;
let currentStages = [];

async function loadProgress() {
  const targetStaffId = staffSelect.value;
  const category = categorySelect.value;
  if (!targetStaffId) return;

  const listEl = document.getElementById('unitsList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/training/progress?staff_id=${targetStaffId}&category=${category}`);
  const data = await res.json();
  renderUnits(data.units || []);

  if (category === 'housekeeping') loadExams(targetStaffId);

  document.getElementById('stageSection').style.display = 'block';
  loadStages(targetStaffId);
}

async function loadStages(targetStaffId) {
  const res = await fetch(`${API}/api/assessment/stages?staff_id=${targetStaffId}`);
  currentStages = await res.json();
  selectedStage = selectedStage || STAGES[0];
  renderStageStepper();
  renderStageForm();
}

function renderStageStepper() {
  const el = document.getElementById('stageStepper');
  el.innerHTML = '';
  STAGES.forEach((stage) => {
    const info = currentStages.find((s) => s.stage === stage);
    const pill = document.createElement('div');
    pill.className = 'stage-pill' + (stage === selectedStage ? ' selected' : '') + (info?.result === 'pass' ? ' pass' : '');
    const statusText = info?.result === 'pass' ? '已通過' : info?.result === 'not_yet' ? '未通過' : '尚未評核';
    pill.innerHTML = `<div>${stage}</div><div class="stage-status">${statusText}</div>`;
    pill.addEventListener('click', () => { selectedStage = stage; renderStageStepper(); renderStageForm(); });
    el.appendChild(pill);
  });
}

function renderStageForm() {
  const el = document.getElementById('stageForm');
  const info = currentStages.find((s) => s.stage === selectedStage) || { category_ratings: {} };
  const ratings = info.category_ratings || {};

  el.innerHTML = `
    <div class="exam-card">
      <p style="font-weight:500;margin:0 0 10px;">${selectedStage}階段評核</p>
      <div class="rating-grid">
        ${CATEGORIES.map((cat) => `
          <div class="rating-item">
            <label>${cat}</label>
            <select data-cat="${cat}">
              <option value="" ${!ratings[cat] ? 'selected' : ''}>未評</option>
              <option value="good" ${ratings[cat] === 'good' ? 'selected' : ''}>良好</option>
              <option value="ok" ${ratings[cat] === 'ok' ? 'selected' : ''}>普通</option>
              <option value="needs_improvement" ${ratings[cat] === 'needs_improvement' ? 'selected' : ''}>待加強</option>
            </select>
          </div>`).join('')}
      </div>
      <div class="field"><label>評核者</label><input type="text" id="stageEvaluator" value="${info.evaluated_by || ''}"></div>
      <div class="field"><label>備註</label><textarea id="stageNotes">${info.notes || ''}</textarea></div>
      <div class="field"><label>結果</label>
        <select id="stageResult">
          <option value="" ${!info.result ? 'selected' : ''}>尚未判定</option>
          <option value="pass" ${info.result === 'pass' ? 'selected' : ''}>通過</option>
          <option value="not_yet" ${info.result === 'not_yet' ? 'selected' : ''}>尚未通過</option>
        </select>
      </div>
      <button class="primary" id="stageSaveBtn">儲存${selectedStage}階段評核</button>
    </div>`;

  document.getElementById('stageSaveBtn').addEventListener('click', saveStage);
}

async function saveStage() {
  const categoryRatings = {};
  document.querySelectorAll('#stageForm [data-cat]').forEach((sel) => {
    if (sel.value) categoryRatings[sel.dataset.cat] = sel.value;
  });

  const payload = {
    staff_id: staffSelect.value,
    stage: selectedStage,
    evaluated_by: document.getElementById('stageEvaluator').value,
    category_ratings: categoryRatings,
    result: document.getElementById('stageResult').value || null,
    notes: document.getElementById('stageNotes').value,
  };

  await fetch(`${API}/api/assessment/stages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  loadStages(staffSelect.value);
}

function renderUnits(units) {
  const listEl = document.getElementById('unitsList');
  if (units.length === 0) {
    listEl.innerHTML = '<p class="empty-state">目前沒有學習項目。</p>';
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
      lastCategory = null; // 換主題後分類標題要重新顯示
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

    row.innerHTML = `
      <p class="unit-name">${u.item_name}</p>
      <div class="unit-fields">
        <input type="text" class="f-trainer" placeholder="培訓員" value="${u.progress?.trainer_name || ''}">
        <input type="date" class="f-date" value="${u.progress?.taught_date || ''}">
        <select class="f-result">
          <option value="" ${!result ? 'selected' : ''}>尚未驗收</option>
          <option value="pass" ${result === 'pass' ? 'selected' : ''}>合格</option>
          <option value="fail" ${result === 'fail' ? 'selected' : ''}>不合格</option>
        </select>
        <button>儲存</button>
      </div>`;

    row.querySelector('button').addEventListener('click', () => saveUnit(u.id, row));
    listEl.appendChild(row);
  });
}

async function saveUnit(unitId, row) {
  const trainerName = row.querySelector('.f-trainer').value;
  const taughtDate = row.querySelector('.f-date').value || null;
  const result = row.querySelector('.f-result').value || null;

  await fetch(`${API}/api/training/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staffSelect.value, unit_id: unitId, trainer_name: trainerName, taught_date: taughtDate, result }),
  });
  loadProgress();
}

async function loadExams(targetStaffId) {
  const res = await fetch(`${API}/api/training/exams?staff_id=${targetStaffId}`);
  const exams = await res.json();
  const listEl = document.getElementById('examList');

  if (exams.length === 0) {
    listEl.innerHTML = '<p class="empty-state">目前沒有考核紀錄。</p>';
    return;
  }

  listEl.innerHTML = exams.map((e) => `
    <div class="exam-card">
      <div class="card-row">
        <span class="card-title">${new Date(e.assessed_at).toLocaleDateString('zh-TW')}</span>
        <span class="badge" style="background:${e.passed ? 'var(--accent-soft)' : 'var(--danger-soft)'};color:${e.passed ? 'var(--accent)' : 'var(--danger)'};">${e.passed ? '合格' : '不合格'}</span>
      </div>
      <p style="font-size:12px;color:var(--ink-soft);margin:6px 0 0;">${e.room_breakdown || ''}・限時${e.time_limit_minutes}分鐘・分數${e.score ?? '—'}</p>
      ${e.notes ? `<p style="font-size:12px;margin:4px 0 0;">${e.notes}</p>` : ''}
    </div>`).join('');
}

async function submitExam() {
  const payload = {
    staff_id: staffSelect.value,
    room_breakdown: document.getElementById('examBreakdown').value,
    time_limit_minutes: Number(document.getElementById('examTimeLimit').value) || 240,
    score: Number(document.getElementById('examScore').value) || null,
    passed: document.getElementById('examPassed').checked,
    assessed_by: document.getElementById('examAssessor').value,
    notes: document.getElementById('examNotes').value,
  };

  await fetch(`${API}/api/training/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  document.getElementById('examBreakdown').value = '';
  document.getElementById('examScore').value = '';
  document.getElementById('examNotes').value = '';
  document.getElementById('examPassed').checked = false;
  loadExams(staffSelect.value);
}
