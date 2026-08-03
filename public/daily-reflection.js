const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
document.getElementById('submitBtn').addEventListener('click', submit);

load();

async function load() {
  const res = await fetch(`${API}/api/reflections/daily?staff_id=${staff.id}&date=${today}`);
  const data = await res.json();
  if (data) {
    document.getElementById('q1').value = data.completed_tasks || '';
    document.getElementById('q2').value = data.best_task || '';
    document.getElementById('q3').value = data.problems || '';
    document.getElementById('q4').value = data.needs_help || '';
    document.getElementById('q5').value = data.improve_tomorrow || '';
    document.getElementById('statusMsg').style.color = 'var(--accent)';
    document.getElementById('statusMsg').textContent = '今天已經填過了，送出會更新內容';
  }
}

async function submit() {
  const btn = document.getElementById('submitBtn');
  btn.textContent = '送出中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/reflections/daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staff.id,
        branch_id: staff.branch_id,
        work_date: today,
        completed_tasks: document.getElementById('q1').value,
        best_task: document.getElementById('q2').value,
        problems: document.getElementById('q3').value,
        needs_help: document.getElementById('q4').value,
        improve_tomorrow: document.getElementById('q5').value,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '送出失敗');
    document.getElementById('statusMsg').style.color = 'var(--accent)';
    document.getElementById('statusMsg').textContent = '已送出，辛苦了！';
  } catch (err) {
    document.getElementById('statusMsg').style.color = 'var(--danger)';
    document.getElementById('statusMsg').textContent = err.message;
  } finally {
    btn.textContent = '送出今日自評';
    btn.disabled = false;
  }
}
