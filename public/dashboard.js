const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const dateInput = document.getElementById('viewDate');
dateInput.value = new Date().toISOString().slice(0, 10);
dateInput.addEventListener('change', loadSummary);

document.getElementById('staffLine').textContent = staff.name;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('staff');
  window.location.href = 'index.html';
});

loadSummary();

async function loadSummary() {
  try {
    const res = await fetch(`${API}/api/dashboard/summary?branch_id=${staff.branch_id}&date=${dateInput.value}`);
    if (!res.ok) throw new Error((await res.json()).error || '讀取失敗');
    render(await res.json());
  } catch (err) {
    alert(err.message);
  }
}

function render(data) {
  document.getElementById('mRooms').textContent = `${data.rooms.completed} / ${data.rooms.total}`;
  document.getElementById('mDefects').textContent = data.rooms.with_defect;

  const dc = data.deep_clean;
  document.getElementById('mDeepClean').textContent =
    dc.total > 0 ? `${dc.completed} / ${dc.total}` : '尚無資料';

  const bonusBody = document.querySelector('#bonusTable tbody');
  bonusBody.innerHTML = '';
  if (data.bonus.staff.length === 0) {
    bonusBody.innerHTML = '<tr><td colspan="6" style="color:var(--ink-soft);">尚無房務同仁資料</td></tr>';
  }
  data.bonus.staff.forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.rooms_completed}</td>
      <td class="${s.defect_count > 0 ? 'miss' : ''}">${s.defect_count}</td>
      <td>${s.net_rooms}</td>
      <td>${s.met_target ? '✓' : `未達（目標${data.bonus.target}間）`}</td>
      <td>$${s.bonus_amount}</td>`;
    bonusBody.appendChild(tr);
  });

  const defectBody = document.querySelector('#defectTable tbody');
  defectBody.innerHTML = '';
  if (data.unresolved_defects.length === 0) {
    defectBody.innerHTML = '<tr><td colspan="4" style="color:var(--ink-soft);">目前沒有未處理的缺失</td></tr>';
  }
  data.unresolved_defects.forEach((d) => {
    const tr = document.createElement('tr');
    const sourceLabel = { room: '客房', public_area: '公共空間', deep_clean: '細清', shift_task: '客務任務' }[d.source_type] || d.source_type;
    tr.innerHTML = `
      <td>${sourceLabel}</td>
      <td>${d.description || '—'}</td>
      <td>${d.staff?.name || '—'}</td>
      <td>${new Date(d.reported_at).toLocaleString('zh-TW')}</td>`;
    defectBody.appendChild(tr);
  });
}
