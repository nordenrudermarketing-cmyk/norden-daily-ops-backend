const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const categorySelect = document.getElementById('categorySelect');
const traineeSelect = document.getElementById('traineeSelect');

categorySelect.addEventListener('change', init);
traineeSelect.addEventListener('change', loadAssignments);

let staffOptions = [];

init();

async function init() {
  const category = categorySelect.value;
  staffOptions = await fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}&category=${category}`).then((r) => r.json());
  traineeSelect.innerHTML = staffOptions.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  loadAssignments();
}

async function loadAssignments() {
  const category = categorySelect.value;
  const traineeId = traineeSelect.value;
  if (!traineeId) return;

  const listEl = document.getElementById('unitsList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/training/assign-list?branch_id=${staff.branch_id}&category=${category}&trainee_id=${traineeId}`);
  const units = await res.json();
  renderUnits(units);

  document.getElementById('stageSection').style.display = category === 'housekeeping' ? 'block' : 'none';
  document.getElementById('examSection').style.display = category === 'housekeeping' ? 'block' : 'none';
  if (category === 'housekeeping') {
    loadStages();
    loadExams();
  }
}

function renderUnits(units) {
  const listEl = document.getElementById('unitsList');
  if (units.length === 0) {
    listEl.innerHTML = '<p class="empty-state">目前沒有學習項目。</p>';
    return;
  }

  listEl.innerHTML = '';
  let lastTopic = null;
  let lastCategory = null;

  units.forEach((u) => {
    if (u.topic && u.topic !== lastTopic) {
      const t = document.createElement('div');
      t.className = 'unit-topic-title';
      t.textContent = u.topic;
      listEl.appendChild(t);
      lastTopic = u.topic; lastCategory = null;
    }
    if (u.category !== lastCategory) {
      const c = document.createElement('div');
      c.className = 'unit-group-title';
      c.textContent = u.category;
      listEl.appendChild(c);
      lastCategory = u.category;
    }

    const isDone = u.assignment?.status === 'completed';
    const row = document.createElement('div');
    row.className = 'assign-row' + (isDone ? ' done' : '');
    row.innerHTML = `<span class="name">${u.item_name}</span>`;

    if (isDone) {
      row.innerHTML += `<span style="font-size:11px;color:var(--ink-soft);">已完成教學（${u.assignment.trainer?.name || ''}）</span>`;
    } else {
      const select = document.createElement('select');
      select.innerHTML = '<option value="">未指派教練</option>' +
        staffOptions.filter((s) => s.id !== traineeSelect.value).map((s) => `<option value="${s.id}" ${s.id === u.assignment?.trainer_id ? 'selected' : ''}>${s.name}</option>`).join('');

      const dueInput = document.createElement('input');
      dueInput.type = 'text';
      dueInput.placeholder = '期限 YYYY-MM-DD';
      dueInput.value = u.assignment?.due_date || '';
      dueInput.style.cssText = 'width:120px;padding:6px;border:1px solid var(--line);border-radius:6px;font-size:12px;';

      const saveFn = () => saveAssignment(u.id, select.value, dueInput.value);
      select.addEventListener('change', saveFn);
      dueInput.addEventListener('change', saveFn);

      row.appendChild(select);
      row.appendChild(dueInput);
    }
    listEl.appendChild(row);
  });
}

async function saveAssignment(unitId, trainerId, dueDate) {
  if (!trainerId) return;
  await fetch(`${API}/api/training/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unit_id: unitId, trainee_id: traineeSelect.value, trainer_id: trainerId, assigned_by: staff.id, due_date: dueDate || null }),
  });
}

// ---------- 四階段考核 ----------
const CATEGORIES = ['工作態度', '專業能力', '工作品質', '工作效率', '溝通能力', '團隊合作', '主動性', '責任感', '問題處理', '品牌認同'];
const STAGES = ['認識', '操作', '獨立', '穩定'];
let selectedStage = STAGES[0];
let currentStages = [];

async function loadStages() {
  const res = await fetch(`${API}/api/assessment/stages?staff_id=${traineeSelect.value}`);
  currentStages = await res.json();
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
      <div class="field"><label>評核者</label><input type="text" id="stageEvaluator" value="${info.evaluated_by || staff.name}"></div>
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
  document.querySelectorAll('#stageForm [data-cat]').forEach((sel) => { if (sel.value) categoryRatings[sel.dataset.cat] = sel.value; });

  await fetch(`${API}/api/assessment/stages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staff_id: traineeSelect.value,
      stage: selectedStage,
      evaluated_by: document.getElementById('stageEvaluator').value,
      category_ratings: categoryRatings,
      result: document.getElementById('stageResult').value || null,
      notes: document.getElementById('stageNotes').value,
    }),
  });
  loadStages();
}

// ---------- 整房實作考核 ----------
document.getElementById('examSubmit').addEventListener('click', submitExam);

async function loadExams() {
  const res = await fetch(`${API}/api/training/exams?staff_id=${traineeSelect.value}`);
  const exams = await res.json();
  const listEl = document.getElementById('examList');
  if (exams.length === 0) { listEl.innerHTML = '<p class="empty-state">目前沒有考核紀錄。</p>'; return; }
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
    staff_id: traineeSelect.value,
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
  loadExams();
}
