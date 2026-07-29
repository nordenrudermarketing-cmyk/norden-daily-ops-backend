const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const SHIFT_CODES = ['', 'A', 'B', 'C', '房', '中', '昼', '特', '1', 'PT1', 'PT2', '管'];
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const ON_DUTY_FRONTDESK = ['A', 'B', 'C', '中', '昼', 'PT1', 'PT2', '管'];
const CATEGORY_LABEL = { frontdesk: '客務', housekeeping: '房務', management: '管理' };

document.getElementById('staffLine').textContent = staff.name;

const monthInput = document.getElementById('monthInput');
monthInput.value = new Date().toISOString().slice(0, 7);
monthInput.addEventListener('change', loadMonth);
document.getElementById('saveBtn').addEventListener('click', saveAll);

let monthData = null;
let blackoutSet = new Set();
let scheduleMap = {}; // staff_id -> { 'YYYY-MM-DD': code }
let teamLeadMap = {}; // 'YYYY-MM-DD' -> staff_id

loadMonth();

function daysInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

async function loadMonth() {
  const monthStr = monthInput.value; // YYYY-MM
  const monthDate = `${monthStr}-01`;

  const res = await fetch(`${API}/api/schedule/month?branch_id=${staff.branch_id}&month=${monthDate}`);
  monthData = await res.json();

  blackoutSet = new Set(monthData.blackout_dates || []);
  scheduleMap = {};
  (monthData.schedule || []).forEach((s) => {
    scheduleMap[s.staff_id] = scheduleMap[s.staff_id] || {};
    scheduleMap[s.staff_id][s.work_date] = s.shift_code;
  });
  teamLeadMap = {};
  (monthData.team_leads || []).forEach((t) => { teamLeadMap[t.work_date] = t.staff_id; });

  document.getElementById('targetOff').value = monthData.settings.target_off_days;
  document.getElementById('minFrontdesk').value = monthData.settings.min_staff_frontdesk;
  document.getElementById('minHousekeeping').value = monthData.settings.min_staff_housekeeping;

  renderTable(monthStr);
}

function renderTable(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const total = daysInMonth(monthStr);
  const days = Array.from({ length: total }, (_, i) => i + 1);
  const dateStr = (d) => `${monthStr}-${String(d).padStart(2, '0')}`;

  const table = document.getElementById('schedTable');
  table.innerHTML = '';

  // 表頭
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th class="name-col">姓名</th>';
  days.forEach((d) => {
    const ds = dateStr(d);
    const weekday = new Date(y, m - 1, d).getDay();
    const th = document.createElement('th');
    th.className = 'day-btn' + (blackoutSet.has(ds) ? ' blackout' : '');
    th.textContent = `${d}(${WEEKDAY_LABELS[weekday]})`;
    th.dataset.date = ds;
    th.addEventListener('click', () => toggleBlackout(ds, th));
    headRow.appendChild(th);
  });
  const offTh = document.createElement('th');
  offTh.textContent = '休假天數';
  headRow.appendChild(offTh);
  thead.appendChild(headRow);
  table.appendChild(thead);

  // 表身：依部門分組
  const tbody = document.createElement('tbody');
  const grouped = {};
  monthData.staff.forEach((s) => {
    const cat = s.roles?.category || 'other';
    grouped[cat] = grouped[cat] || [];
    grouped[cat].push(s);
  });

  ['frontdesk', 'housekeeping', 'management'].forEach((cat) => {
    if (!grouped[cat]) return;
    const groupRow = document.createElement('tr');
    groupRow.className = 'group-row';
    groupRow.innerHTML = `<td colspan="${days.length + 2}">${CATEGORY_LABEL[cat]}</td>`;
    tbody.appendChild(groupRow);

    grouped[cat].forEach((s) => {
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.className = 'name-col';
      nameTd.textContent = s.name;
      tr.appendChild(nameTd);

      days.forEach((d) => {
        const ds = dateStr(d);
        const td = document.createElement('td');
        if (blackoutSet.has(ds)) td.classList.add('blackout-col');
        const select = document.createElement('select');
        select.dataset.staffId = s.id;
        select.dataset.date = ds;
        select.dataset.category = cat;
        SHIFT_CODES.forEach((code) => {
          const opt = document.createElement('option');
          opt.value = code;
          opt.textContent = code || '　';
          if ((scheduleMap[s.id]?.[ds] || '') === code) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener('change', updateTotals);
        td.appendChild(select);
        tr.appendChild(td);
      });

      const offTd = document.createElement('td');
      offTd.className = 'off-total';
      offTd.id = `off-${s.id}`;
      tr.appendChild(offTd);

      tbody.appendChild(tr);
    });
  });

  // 統計列
  const frontdeskRow = document.createElement('tr');
  frontdeskRow.className = 'summary-row';
  frontdeskRow.innerHTML = '<td class="name-col">客務上班人數</td>' +
    days.map((d) => `<td id="sumF-${dateStr(d)}"></td>`).join('') + '<td></td>';
  tbody.appendChild(frontdeskRow);

  const housekeepingRow = document.createElement('tr');
  housekeepingRow.className = 'summary-row';
  housekeepingRow.innerHTML = '<td class="name-col">房務上班人數</td>' +
    days.map((d) => `<td id="sumH-${dateStr(d)}"></td>`).join('') + '<td></td>';
  tbody.appendChild(housekeepingRow);

  // 房務小隊長（經理排班時一併指定）
  const leadRow = document.createElement('tr');
  leadRow.className = 'lead-row';
  const leadNameTd = document.createElement('td');
  leadNameTd.className = 'name-col';
  leadNameTd.textContent = '房務小隊長';
  leadRow.appendChild(leadNameTd);

  const housekeepingStaffList = grouped['housekeeping'] || [];
  days.forEach((d) => {
    const ds = dateStr(d);
    const td = document.createElement('td');
    const select = document.createElement('select');
    select.dataset.date = ds;
    select.innerHTML = '<option value="">—</option>' +
      housekeepingStaffList.map((s) => `<option value="${s.id}" ${s.id === teamLeadMap[ds] ? 'selected' : ''}>${s.name}</option>`).join('');
    td.appendChild(select);
    leadRow.appendChild(td);
  });
  leadRow.appendChild(document.createElement('td'));
  tbody.appendChild(leadRow);

  table.appendChild(tbody);

  updateTotals();
}

function toggleBlackout(dateStr, th) {
  if (blackoutSet.has(dateStr)) {
    blackoutSet.delete(dateStr);
    th.classList.remove('blackout');
  } else {
    blackoutSet.add(dateStr);
    th.classList.add('blackout');
  }
  document.querySelectorAll(`td select[data-date="${dateStr}"]`).forEach((sel) => {
    sel.closest('td').classList.toggle('blackout-col', blackoutSet.has(dateStr));
  });
}

function updateTotals() {
  const targetOff = Number(document.getElementById('targetOff').value) || 11;
  const minFrontdesk = Number(document.getElementById('minFrontdesk').value) || 3;
  const minHousekeeping = Number(document.getElementById('minHousekeeping').value) || 3;

  // 每位同仁休假天數
  const offCounts = {};
  document.querySelectorAll('#schedTable select').forEach((sel) => {
    const id = sel.dataset.staffId;
    offCounts[id] = offCounts[id] || 0;
    if (sel.value === '1') offCounts[id]++;
  });
  Object.entries(offCounts).forEach(([id, count]) => {
    const cell = document.getElementById(`off-${id}`);
    if (!cell) return;
    cell.textContent = count;
    cell.classList.toggle('mismatch', count !== targetOff);
  });

  // 每日部門上班人數
  const dailyFrontdesk = {};
  const dailyHousekeeping = {};
  document.querySelectorAll('#schedTable select').forEach((sel) => {
    const ds = sel.dataset.date;
    if (sel.dataset.category === 'frontdesk' && ON_DUTY_FRONTDESK.includes(sel.value)) {
      dailyFrontdesk[ds] = (dailyFrontdesk[ds] || 0) + 1;
    }
    if (sel.dataset.category === 'housekeeping' && sel.value === '房') {
      dailyHousekeeping[ds] = (dailyHousekeeping[ds] || 0) + 1;
    }
  });

  document.querySelectorAll('[id^="sumF-"]').forEach((cell) => {
    const ds = cell.id.replace('sumF-', '');
    const count = dailyFrontdesk[ds] || 0;
    cell.textContent = count;
    cell.classList.toggle('low', count < minFrontdesk);
  });
  document.querySelectorAll('[id^="sumH-"]').forEach((cell) => {
    const ds = cell.id.replace('sumH-', '');
    const count = dailyHousekeeping[ds] || 0;
    cell.textContent = count;
    cell.classList.toggle('low', count < minHousekeeping);
  });
}

async function saveAll() {
  const entries = [];
  document.querySelectorAll('#schedTable select').forEach((sel) => {
    if (!sel.dataset.staffId) return; // 排除房務小隊長那一列（沒有 staffId，是另一種資料）
    if (sel.value) entries.push({ staff_id: sel.dataset.staffId, work_date: sel.dataset.date, shift_code: sel.value });
  });

  const teamLeads = {};
  document.querySelectorAll('.lead-row select').forEach((sel) => {
    teamLeads[sel.dataset.date] = sel.value || null;
  });

  const monthDate = `${monthInput.value}-01`;
  const btn = document.getElementById('saveBtn');
  btn.textContent = '儲存中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/schedule/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: staff.branch_id,
        month: monthDate,
        entries,
        blackout_dates: Array.from(blackoutSet),
        settings: {
          target_off_days: Number(document.getElementById('targetOff').value) || 11,
          min_staff_frontdesk: Number(document.getElementById('minFrontdesk').value) || 3,
          min_staff_housekeeping: Number(document.getElementById('minHousekeeping').value) || 3,
        },
        team_leads: teamLeads,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '儲存失敗');
    alert('排班表已儲存');
  } catch (err) {
    alert(err.message);
  } finally {
    btn.textContent = '儲存排班表';
    btn.disabled = false;
  }
}
