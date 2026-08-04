const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
document.getElementById('staffLine').textContent = `${staff.name}・${today}`;

document.getElementById('sweepSaveBtn').addEventListener('click', saveSweep);
document.getElementById('addNoteBtn').addEventListener('click', addNote);
document.getElementById('reviewSaveBtn').addEventListener('click', saveReview);
document.getElementById('noShowSaveBtn').addEventListener('click', saveNoShow);

loadSweep();
loadNotes();
loadReview();
loadNoShow();

// ---------- 掃單 ----------
async function loadSweep() {
  const res = await fetch(`${API}/api/order-sweep/today?branch_id=${staff.branch_id}&date=${today}`);
  const data = await res.json();
  if (!data) return;
  document.getElementById('checkinCount').value = data.checkin_count ?? '';
  document.getElementById('checkinAnomaly').value = data.checkin_anomaly || '';
  document.getElementById('checkinOrderNo').value = data.checkin_order_no || '';
  document.getElementById('newOrderCount').value = data.new_order_count ?? '';
  document.getElementById('newOrderMissing').value = data.new_order_missing || '';
  document.getElementById('newOrderNo').value = data.new_order_no || '';
}

async function saveSweep() {
  await fetch(`${API}/api/order-sweep/today`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: staff.branch_id,
      work_date: today,
      checkin_count: Number(document.getElementById('checkinCount').value) || null,
      checkin_anomaly: document.getElementById('checkinAnomaly').value,
      checkin_order_no: document.getElementById('checkinOrderNo').value,
      new_order_count: Number(document.getElementById('newOrderCount').value) || null,
      new_order_missing: document.getElementById('newOrderMissing').value,
      new_order_no: document.getElementById('newOrderNo').value,
      updated_by: staff.id,
    }),
  });
  showStatus('sweepStatus', '已儲存');
}

async function loadNotes() {
  const res = await fetch(`${API}/api/order-sweep/notes?branch_id=${staff.branch_id}`);
  const notes = await res.json();
  const el = document.getElementById('notesList');
  if (notes.length === 0) { el.innerHTML = '<p class="empty-state">目前沒有提醒。</p>'; return; }
  el.innerHTML = notes.map((n) => `
    <div class="note-item">
      ${n.order_no ? `<strong>#${n.order_no}</strong> ` : ''}${n.content}
      <div style="color:var(--ink-soft);font-size:11px;">${n.staff?.name || ''}・${new Date(n.created_at).toLocaleDateString('zh-TW')}</div>
    </div>`).join('');
}

async function addNote() {
  const content = document.getElementById('newNote').value.trim();
  if (!content) return;
  await fetch(`${API}/api/order-sweep/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: staff.branch_id,
      order_no: document.getElementById('newNoteOrderNo').value,
      content,
      staff_id: staff.id,
    }),
  });
  document.getElementById('newNote').value = '';
  document.getElementById('newNoteOrderNo').value = '';
  loadNotes();
}

// ---------- 評論回報 ----------
async function loadReview() {
  const res = await fetch(`${API}/api/review-checks/today?branch_id=${staff.branch_id}&date=${today}`);
  const data = await res.json();
  if (!data) return;
  document.getElementById('bkNote').value = data.bk_note || '';
  document.getElementById('agNote').value = data.ag_note || '';
  document.getElementById('ctripNote').value = data.ctrip_note || '';
  document.getElementById('googleNote').value = data.google_note || '';
  document.getElementById('specialReport').value = data.special_report || '';
}

async function saveReview() {
  await fetch(`${API}/api/review-checks/today`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: staff.branch_id,
      work_date: today,
      bk_note: document.getElementById('bkNote').value,
      ag_note: document.getElementById('agNote').value,
      ctrip_note: document.getElementById('ctripNote').value,
      google_note: document.getElementById('googleNote').value,
      special_report: document.getElementById('specialReport').value,
      staff_id: staff.id,
    }),
  });
  showStatus('reviewStatus', '已儲存');
}

// ---------- NO SHOW ----------
async function loadNoShow() {
  const res = await fetch(`${API}/api/no-show/today?branch_id=${staff.branch_id}&date=${today}`);
  const data = await res.json();
  if (!data) return;
  document.getElementById('nsOrder').value = data.order_info || '';
  document.getElementById('nsCharged').value = data.charged_note || '';
  document.getElementById('nsUncharged').value = data.uncharged_note || '';
  document.getElementById('nsNote').value = data.note || '';
}

async function saveNoShow() {
  await fetch(`${API}/api/no-show/today`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: staff.branch_id,
      work_date: today,
      order_info: document.getElementById('nsOrder').value || '無',
      charged_note: document.getElementById('nsCharged').value || '無',
      uncharged_note: document.getElementById('nsUncharged').value || '無',
      note: document.getElementById('nsNote').value || '無',
      staff_id: staff.id,
    }),
  });
  showStatus('noShowStatus', '已儲存');
}

function showStatus(elId, msg) {
  const el = document.getElementById(elId);
  el.style.color = 'var(--accent)';
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 3000);
}
