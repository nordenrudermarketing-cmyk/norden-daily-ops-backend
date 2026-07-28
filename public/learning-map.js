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
