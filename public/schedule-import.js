const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('monthInput').value = new Date().toISOString().slice(0, 7);
document.getElementById('fileInput').addEventListener('change', handleFile);

// 這些是已知的「非人員」標籤列，抓到就直接跳過，不放進警示清單裡（避免誤導）
const KNOWN_NON_PERSON_LABELS = ['房務小隊長', '櫃台', '房務', '實際人數', '共休'];

let staffList = [];
let parsedEntries = []; // { staff_id, staff_name, days: {dayNum: code} }
let unmatchedNames = new Set();
let teamLeadRow = null; // { days: { dayNum: 'nickname' } }

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

// 班別代碼正規化：某些代碼只是多加了註記，實際上還是同一種班別
// 例如「房(加)」是房務班當天加班、「房/特」是房務班當天部分時段請特休，
// 這兩種本質上都還是房務班的任務，匯入時統一還原成「房」
function normalizeShiftCode(raw) {
  const t = raw.trim();
  if (t.startsWith('房')) return '房';
  return t;
}

// 姓名比對：先完全比對，比對不到再嘗試「這一列前面幾欄合併起來的文字裡有沒有包含姓名的中文部分」
// （用來抓像實習生那種姓名沒填在姓名欄、而是跟到職日期、外文名混在一起的狀況）
function matchStaffInRow(row, nameColRange) {
  for (let c = 0; c < nameColRange; c++) {
    const cellText = String(row[c] || '').trim();
    if (!cellText) continue;
    const exact = staffList.find((s) => s.name.trim() === cellText);
    if (exact) return exact;
  }

  const combinedText = Array.from({ length: nameColRange }, (_, c) => String(row[c] || '')).join(' ');
  for (const s of staffList) {
    const chineseOnly = s.name.replace(/[a-zA-Z0-9]/g, '').trim();
    if (chineseOnly.length >= 2 && combinedText.includes(chineseOnly)) return s;
  }
  return null;
}

function parseRows(rows) {
  let headerRowIdx = -1;
  let dayColumns = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const candidates = [];
    for (let c = 0; c < row.length; c++) {
      const v = Number(row[c]);
      if (Number.isInteger(v) && v >= 1 && v <= 31) candidates.push({ col: c, day: v });
    }
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

  const nameColRange = Math.min(...dayColumns.map((d) => d.col));

  // 每個房務同仁的暱稱＝姓名最後一個字（跟你確認過的規則）
  const nicknameMap = {};
  staffList.forEach((s) => {
    const lastChar = s.name.trim().slice(-1);
    nicknameMap[lastChar] = s;
  });

  parsedEntries = [];
  unmatchedNames = new Set();
  teamLeadRow = null;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];

    // 先檢查是不是「房務小隊長」這種暱稱列
    const leadingText = Array.from({ length: nameColRange }, (_, c) => String(row[c] || '').trim()).join('');
    if (leadingText.includes('房務小隊長')) {
      const days = {};
      dayColumns.forEach((d) => {
        const nickname = String(row[d.col] || '').trim();
        if (nickname && nicknameMap[nickname]) days[d.day] = nicknameMap[nickname].id;
      });
      teamLeadRow = { days };
      continue;
    }

    const matchedStaff = matchStaffInRow(row, nameColRange);
    const filledDayCells = dayColumns.filter((d) => String(row[d.col] || '').trim() !== '').length;

    if (matchedStaff) {
      const days = {};
      dayColumns.forEach((d) => {
        const raw = String(row[d.col] || '').trim();
        if (raw) days[d.day] = normalizeShiftCode(raw);
      });
      if (Object.keys(days).length > 0) {
        parsedEntries.push({ staff_id: matchedStaff.id, staff_name: matchedStaff.name, days });
      }
    } else if (filledDayCells >= 3) {
      let guess = '';
      for (let c = 0; c < nameColRange; c++) {
        const t = String(row[c] || '').trim();
        if (t) { guess = t; break; }
      }
      const isKnownLabel = KNOWN_NON_PERSON_LABELS.some((label) => guess.includes(label));
      if (guess && !isKnownLabel) unmatchedNames.add(guess);
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
  if (teamLeadRow) {
    const count = Object.keys(teamLeadRow.days).length;
    html += `<div class="ok-box">有偵測到「房務小隊長」列，共 ${count} 天有比對到暱稱，會一併匯入每日房務小隊長設定。</div>`;
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
  const monthStr = document.getElementById('monthInput').value;
  if (!monthStr) { alert('請選擇這份班表是哪個月份'); return; }

  const entries = [];
  parsedEntries.forEach((e) => {
    Object.entries(e.days).forEach(([day, code]) => {
      const workDate = `${monthStr}-${String(day).padStart(2, '0')}`;
      entries.push({ staff_id: e.staff_id, work_date: workDate, shift_code: code });
    });
  });

  const teamLeads = {};
  if (teamLeadRow) {
    Object.entries(teamLeadRow.days).forEach(([day, staffId]) => {
      const workDate = `${monthStr}-${String(day).padStart(2, '0')}`;
      teamLeads[workDate] = staffId;
    });
  }

  const btn = document.getElementById('confirmBtn');
  btn.textContent = '匯入中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/schedule/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: staff.branch_id, month: `${monthStr}-01`, entries, team_leads: teamLeads }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '匯入失敗');
    alert(`已匯入 ${entries.length} 筆班表紀錄${teamLeadRow ? '，含每日房務小隊長設定' : ''}，可以到排班表頁面確認`);
    window.location.href = 'schedule.html';
  } catch (err) {
    alert(err.message);
    btn.textContent = '確認匯入';
    btn.disabled = false;
  }
}
