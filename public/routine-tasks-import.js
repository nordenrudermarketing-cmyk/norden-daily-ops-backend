const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

document.getElementById('yearMonthInput').value = new Date().toISOString().slice(0, 7);
document.getElementById('fileInput').addEventListener('change', handleFile);

let staffList = [];
let parsedItems = [];

loadStaff();
async function loadStaff() {
  staffList = await fetch(`${API}/api/staff/list?branch_id=${staff.branch_id}&category=frontdesk`).then((r) => r.json());
}

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const reader = new FileReader();
  reader.onload = (evt) => {
    const workbook = isCsv
      ? XLSX.read(evt.target.result, { type: 'string' })
      : XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    parseRows(rows);
  };
  if (isCsv) reader.readAsText(file); else reader.readAsArrayBuffer(file);
}

function normalizeCategory(raw) {
  const t = String(raw).replace(/\n/g, ' ').trim();
  if (t.includes('採購')) return '採購';
  if (t.includes('銀行')) return '銀行';
  if (t.includes('總務')) return '總務';
  return t || '其他';
}

function parseDate(raw, yearMonthInput) {
  const t = String(raw).trim();
  const m = t.match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const year = yearMonthInput.split('-')[0];
  return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function matchStaff(personName) {
  const t = String(personName).trim();
  if (!t) return null;
  let match = staffList.find((s) => s.name === t);
  if (!match) match = staffList.find((s) => s.name.includes(t) || t.includes(s.name));
  return match || null;
}

function parseRows(rows) {
  // 找表頭列：這一列裡要同時有「人員」「項目」這兩個字
  let headerRowIdx = -1;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r].map((c) => String(c).trim());
    if (row.includes('人員') && row.includes('項目')) { headerRowIdx = r; break; }
  }

  if (headerRowIdx === -1) {
    document.getElementById('resultArea').innerHTML = '<div class="warn-box">找不到「人員」「項目」這樣的表頭列，請確認檔案格式，或跟我說一聲。</div>';
    return;
  }

  const yearMonth = document.getElementById('yearMonthInput').value;
  parsedItems = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const person = String(row[0] || '').trim();
    const categoryRaw = String(row[1] || '').trim();
    const item = String(row[2] || '').trim();
    const progress = String(row[3] || '').trim();
    const due = String(row[4] || '').trim();
    const actual = String(row[5] || '').trim();
    const note = String(row[6] || '').trim();

    if (!item) continue; // 沒有項目內容的列跳過

    const matchedStaff = matchStaff(person);
    const noteParts = [progress, note].filter(Boolean);

    parsedItems.push({
      category: normalizeCategory(categoryRaw),
      person_name: person,
      matched_staff: matchedStaff,
      item_name: item,
      progress_note: noteParts.join('；'),
      due_date: parseDate(due, yearMonth),
      status: actual ? 'completed' : 'pending',
    });
  }

  renderPreview();
}

function renderPreview() {
  const area = document.getElementById('resultArea');
  if (parsedItems.length === 0) {
    area.innerHTML = '<div class="warn-box">沒有解析到任何項目。</div>';
    return;
  }

  const unmatchedCount = parsedItems.filter((it) => !it.matched_staff && it.person_name).length;
  let html = `<div class="ok-box">解析到 ${parsedItems.length} 筆項目，確認下面內容沒問題後點「確認匯入」。</div>`;
  if (unmatchedCount > 0) {
    html += `<div class="warn-box">有 ${unmatchedCount} 筆的負責人姓名比對不到系統同仁，匯入後負責人欄位會是空的，需要手動在例行事項管理頁面補上。</div>`;
  }

  html += '<table class="preview"><thead><tr><th>類別</th><th>項目</th><th>負責人</th><th>進度說明</th><th>預計完成</th><th>狀態</th></tr></thead><tbody>';
  parsedItems.forEach((it) => {
    html += `<tr>
      <td>${it.category}</td>
      <td>${it.item_name}</td>
      <td>${it.matched_staff ? it.matched_staff.name : `<span style="color:var(--danger);">${it.person_name || '未指定'}</span>`}</td>
      <td>${it.progress_note}</td>
      <td>${it.due_date || '—'}</td>
      <td>${it.status === 'completed' ? '已完成' : '待處理'}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  html += '<button class="primary" id="confirmBtn" style="width:auto;padding:10px 24px;">確認匯入</button>';
  area.innerHTML = html;

  document.getElementById('confirmBtn').addEventListener('click', confirmImport);
}

async function confirmImport() {
  const btn = document.getElementById('confirmBtn');
  btn.textContent = '匯入中…';
  btn.disabled = true;

  try {
    const items = parsedItems.map((it) => ({
      category: it.category,
      item_name: it.item_name,
      progress_note: it.progress_note,
      due_date: it.due_date,
      status: it.status,
      assigned_to: it.matched_staff ? it.matched_staff.id : null,
    }));

    const res = await fetch(`${API}/api/routine-tasks/bulk-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: staff.branch_id, items }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '匯入失敗');
    alert(`已匯入 ${items.length} 筆例行事項`);
    window.location.href = 'routine-tasks-manage.html';
  } catch (err) {
    alert(err.message);
    btn.textContent = '確認匯入';
    btn.disabled = false;
  }
}
