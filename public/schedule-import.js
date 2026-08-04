const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('monthInput').value = new Date().toISOString().slice(0, 7);
document.getElementById('fileInput').addEventListener('change', handleFile);

let staffList = [];
let parsedEntries = []; // { staff_id, staff_name, days: {dayNum: code} }
let unmatchedNames = new Set();

loadStaff();

async function loadStaff() {
  staffList = await fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}`).then((r) => r.json());
}

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    parseRows(rows);
  };
  reader.readAsArrayBuffer(file);
}

function parseRows(rows) {
  // 找出「日期橫列」：某一列裡有連續遞增的數字 1,2,3...
  let headerRowIdx = -1;
  let dayColumns = []; // [{col, day}]

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const candidates = [];
    for (let c = 0; c < row.length; c++) {
      const v = Number(row[c]);
      if (Number.isInteger(v) && v >= 1 && v <= 31) candidates.push({ col: c, day: v });
    }
    // 檢查是否有一段連續遞增（至少10天）
    let bestRun = [];
    let currentRun = [];
    for (let i = 0; i < candidates.length; i++) {
      if (i === 0 || candidates[i].day === candidates[i - 1].day + 1) {
        currentRun.push(candidates[i]);
      } else {
        if (currentRun.length > bestRun.length) bestRun = currentRun;
        currentRun = [candidates[i]];
      }
    }
    if (currentRun.length > bestRun.length) bestRun = currentRun;

    if (bestRun.length >= 10) {
      headerRowIdx = r;
      dayColumns = bestRun;
      break;
    }
  }

  if (headerRowIdx === -1) {
    document.getElementById('resultArea').innerHTML = '<div class="warn-box">找不到日期橫列（1、2、3...這樣的欄位），可能不是預期的班表格式，請確認檔案內容或跟我說一聲，我再調整解析方式。</div>';
    return;
  }

  const nameColRange = Math.min(...dayColumns.map((d) => d.col)); // 姓名欄位一定在日期欄位之前
  const staffByName = {};
  staffList.forEach((s) => { staffByName[s.name.trim()] = s; });

  parsedEntries = [];
  unmatchedNames = new Set();

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    let matchedStaff = null;
    for (let c = 0; c < nameColRange; c++) {
      const cellText = String(row[c] || '').trim();
      if (cellText && staffByName[cellText]) { matchedStaff = staffByName[cellText]; break; }
    }

    // 算這列在日期欄位裡有幾個非空值，判斷是不是一列「資料列」
    const filledDayCells = dayColumns.filter((d) => String(row[d.col] || '').trim() !== '').length;

    if (matchedStaff) {
      const days = {};
      dayColumns.forEach((d) => {
        const code = String(row[d.col] || '').trim();
        if (code) days[d.day] = code;
      });
      if (Object.keys(days).length > 0) {
        parsedEntries.push({ staff_id: matchedStaff.id, staff_name: matchedStaff.name, days });
      }
    } else if (filledDayCells >= 3) {
      // 看起來是資料列但比對不到姓名，抓第一個非空欄位當作猜測姓名
      let guess = '';
      for (let c = 0; c < nameColRange; c++) {
        const t = String(row[c] || '').trim();
        if (t) { guess = t; break; }
      }
      if (guess) unmatchedNames.add(guess);
    }
  }

  renderPreview();
}

function renderPreview() {
  const area = document.getElementById('resultArea');
  let html = '';

  if (unmatchedNames.size > 0) {
    html += `<div class="warn-box">以下姓名在系統裡找不到對應的同仁，這些人的班表不會被匯入：${Array.from(unmatchedNames).join('、')}</div>`;
  }
  if (parsedEntries.length === 0) {
    html += '<div class="warn-box">沒有解析到任何可以匯入的班表資料。</div>';
    area.innerHTML = html;
    return;
  }
  html += `<div class="ok-box">成功比對到 ${parsedEntries.length} 位同仁的班表，確認下面預覽內容沒問題後點「確認匯入」。</div>`;

  const allDays = new Set();
  parsedEntries.forEach((e) => Object.keys(e.days).forEach((d) => allDays.add(Number(d))));
  const days = Array.from(allDays).sort((a, b) => a - b);

  html += '<div class="table-wrap"><table class="preview"><thead><tr><th class="name-col">姓名</th>' +
    days.map((d) => `<th>${d}</th>`).join('') + '</tr></thead><tbody>';
  parsedEntries.forEach((e) => {
    html += `<tr><td class="name-col">${e.staff_name}</td>` +
      days.map((d) => `<td>${e.days[d] || ''}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table></div>';

  html += '<button class="primary" id="confirmBtn" style="width:auto;padding:10px 24px;">確認匯入</button>';
  area.innerHTML = html;

  document.getElementById('confirmBtn').addEventListener('click', confirmImport);
}

async function confirmImport() {
  const monthStr = document.getElementById('monthInput').value; // YYYY-MM
  if (!monthStr) { alert('請選擇這份班表是哪個月份'); return; }

  const entries = [];
  parsedEntries.forEach((e) => {
    Object.entries(e.days).forEach(([day, code]) => {
      const workDate = `${monthStr}-${String(day).padStart(2, '0')}`;
      entries.push({ staff_id: e.staff_id, work_date: workDate, shift_code: code });
    });
  });

  const btn = document.getElementById('confirmBtn');
  btn.textContent = '匯入中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/schedule/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: staff.branch_id, month: `${monthStr}-01`, entries }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '匯入失敗');
    alert(`已匯入 ${entries.length} 筆排班紀錄，可以到排班表頁面確認`);
    window.location.href = 'schedule.html';
  } catch (err) {
    alert(err.message);
    btn.textContent = '確認匯入';
    btn.disabled = false;
  }
}
