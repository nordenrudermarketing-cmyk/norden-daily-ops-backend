const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('staffLine').textContent = staff.name;
document.getElementById('startBtn').addEventListener('click', startExam);
document.getElementById('submitBtn').addEventListener('click', () => submitExam(false));

let attempt = null;
let questions = [];
let timerInterval = null;
let secondsLeft = 0;

async function startExam() {
  const res = await fetch(`${API}/api/written-exam/attempts/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.id, branch_id: staff.branch_id }),
  });
  const data = await res.json();
  attempt = data.attempt;
  questions = data.questions;

  if (questions.length === 0) {
    alert('這個館別還沒有建立筆試題庫，請聯繫總公司');
    return;
  }

  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('examArea').style.display = 'block';
  renderQuestions();

  secondsLeft = (attempt.time_limit_minutes || 40) * 60;
  updateTimerDisplay();
  timerInterval = setInterval(tick, 1000);
}

function tick() {
  secondsLeft -= 1;
  updateTimerDisplay();
  if (secondsLeft <= 300) document.getElementById('timerBar').classList.add('warning');
  if (secondsLeft <= 0) {
    clearInterval(timerInterval);
    alert('時間到，自動送出目前的作答');
    submitExam(true);
  }
}

function updateTimerDisplay() {
  const m = Math.max(Math.floor(secondsLeft / 60), 0);
  const s = Math.max(secondsLeft % 60, 0);
  document.getElementById('timeDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderQuestions() {
  const listEl = document.getElementById('questionsList');
  listEl.innerHTML = '';
  let lastSection = null;

  questions.forEach((q) => {
    if (q.section !== lastSection) {
      const title = document.createElement('div');
      title.style.cssText = 'font-size:15px;font-weight:600;margin:16px 0 8px;';
      title.textContent = q.section;
      listEl.appendChild(title);
      lastSection = q.section;
    }

    const card = document.createElement('div');
    card.className = 'q-card';
    card.dataset.questionId = q.id;

    let inputHtml = '';
    if (q.section === '選擇題') {
      inputHtml = `<div class="mc-options">
        ${['A', 'B', 'C', 'D'].map((opt) => `<label><input type="radio" name="q-${q.id}" value="${opt}"> ${opt}</label>`).join('')}
      </div>`;
    } else if (q.section === '是非題') {
      inputHtml = `<div class="mc-options">
        <label><input type="radio" name="q-${q.id}" value="O"> 是（O）</label>
        <label><input type="radio" name="q-${q.id}" value="X"> 非（X）</label>
      </div>`;
    } else {
      inputHtml = `<textarea data-essay-answer style="min-height:70px;"></textarea>`;
    }

    card.innerHTML = `
      <p class="section-label">第 ${q.question_number} 題</p>
      <p class="q-text">${q.question_text}</p>
      ${q.options_text ? `<p class="options-text">${q.options_text}</p>` : ''}
      ${inputHtml}`;
    listEl.appendChild(card);
  });
}

async function submitExam(auto) {
  if (!auto && !confirm('確定要送出測驗嗎？送出後不能再修改。')) return;
  clearInterval(timerInterval);

  const answers = [];
  document.querySelectorAll('#questionsList .q-card').forEach((card) => {
    const qId = card.dataset.questionId;
    const checked = card.querySelector(`input[name="q-${qId}"]:checked`);
    const essay = card.querySelector('[data-essay-answer]');
    const answerText = checked ? checked.value : (essay ? essay.value : '');
    answers.push({ question_id: qId, answer_text: answerText });
  });

  const res = await fetch(`${API}/api/written-exam/attempts/${attempt.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const result = await res.json();

  document.getElementById('examArea').style.display = 'none';
  document.getElementById('resultScreen').style.display = 'block';
  document.getElementById('resultScore').textContent = `答對 ${result.correct_count} / ${result.total_scored} 題`;
  const passEl = document.getElementById('resultPass');
  if (result.passed) {
    passEl.textContent = '✓ 通過';
    passEl.style.color = 'var(--accent)';
  } else {
    passEl.textContent = '未通過';
    passEl.style.color = 'var(--danger)';
  }
}
