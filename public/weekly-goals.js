const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const weekStart = mondayOf(new Date());
document.getElementById('staffLine').textContent = `${staff.name}・本週（${weekStart} 起）`;
document.getElementById('submitBtn').addEventListener('click', save);

let existing = null;
load();

async function load() {
  const res = await fetch(`${API}/api/reflections/weekly?staff_id=${staff.id}&week_start=${weekStart}`);
  existing = await res.json();
  if (existing) {
    document.getElementById('q1').value = existing.main_goals || '';
    document.getElementById('q2').value = existing.quality_requirements || '';
    document.getElementById('q3').value = existing.completed_items || '';
    document.getElementById('q4').value = existing.pending_items || '';
    document.getElementById('q5').value = existing.needs_help || '';
    document.getElementById('q6').value = existing.next_week_focus || '';

    const banner = document.getElementById('statusBanner');
    if (existing.status === 'confirmed') {
      banner.innerHTML = '<div class="due-banner" style="background:var(--accent-soft);border:1px solid #b9d3c5;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--accent);">主管已經確認過本週目標</div>';
    }
  }
}

async function save() {
  const btn = document.getElementById('submitBtn');
  btn.textContent = '儲存中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/reflections/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staff.id,
        branch_id: staff.branch_id,
        week_start: weekStart,
        main_goals: document.getElementById('q1').value,
        quality_requirements: document.getElementById('q2').value,
        completed_items: document.getElementById('q3').value,
        pending_items: document.getElementById('q4').value,
        needs_help: document.getElementById('q5').value,
        next_week_focus: document.getElementById('q6').value,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '儲存失敗');
    document.getElementById('statusMsg').style.color = 'var(--accent)';
    document.getElementById('statusMsg').textContent = '已儲存';
  } catch (err) {
    document.getElementById('statusMsg').style.color = 'var(--danger)';
    document.getElementById('statusMsg').textContent = err.message;
  } finally {
    btn.textContent = '儲存本週目標';
    btn.disabled = false;
  }
}
