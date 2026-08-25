const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const isManager = staff.roles?.name === '店經理';
document.getElementById('staffLine').textContent = staff.name;
document.getElementById('workDate').value = new Date().toISOString().slice(0, 10);
document.getElementById('submitBtn').addEventListener('click', submitAppeal);
document.getElementById('workDate').addEventListener('change', loadDayStats);
document.getElementById('rejectCancel').addEventListener('click', closeRejectOverlay);
document.getElementById('rejectConfirm').addEventListener('click', confirmReject);

let activeRejectId = null;

if (isManager) {
  // 店經理只審核，不用提交自己的申覆
  document.getElementById('staffForm').style.display = 'none';
  document.getElementById('myList').previousElementSibling.style.display = 'none';
  document.getElementById('myList').style.display = 'none';
  document.getElementById('pageTitle').textContent = '獎金申覆審核';
  document.getElementById('managerSection').style.display = 'block';
  loadPending();
} else {
  loadDayStats();
  loadMine();
}

// ---------- 同仁端：先看當天系統算出來的數據，再決定要申覆成幾間 ----------
async function loadDayStats() {
  const date = document.getElementById('workDate').value;
  if (!date) return;
  const box = document.getElementById('dayStatsBox');
  box.innerHTML = '載入中…';

  const res = await fetch(`${API}/api/bonus-appeals/day-stats?staff_id=${staff.id}&branch_id=${staff.branch_id}&date=${date}`);
  const d = await res.json();

  box.innerHTML = `
    <p style="margin:0 0 4px;font-weight:500;">系統目前算出來的結果</p>
    <p style="margin:2px 0;">分配 ${d.assigned_count} 間・15:00前完成 ${d.completed_before_deadline} 間・缺失 ${d.defect_count} 間</p>
    <p style="margin:2px 0;">淨間數：<strong>${d.net_rooms}</strong>　獎金：<strong>$${d.bonus_amount}</strong>${d.disqualified ? '　<span style="color:var(--danger);">（未達門檻，本來沒有獎金）</span>' : ''}</p>`;
}

async function submitAppeal() {
  const workDate = document.getElementById('workDate').value;
  const requestedRooms = Number(document.getElementById('requestedRooms').value);
  const reason = document.getElementById('reason').value.trim();
  if (!workDate || !requestedRooms || !reason) { alert('請填申覆日期、申覆間數、理由'); return; }

  const res = await fetch(`${API}/api/bonus-appeals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.id, branch_id: staff.branch_id, work_date: workDate, requested_rooms: requestedRooms, reason }),
  });
  if (!res.ok) { alert((await res.json()).error || '送出失敗'); return; }
  document.getElementById('reason').value = '';
  document.getElementById('requestedRooms').value = '';
  alert('已送出申覆，等待店經理審核');
  loadMine();
}

async function loadMine() {
  const res = await fetch(`${API}/api/bonus-appeals/mine?staff_id=${staff.id}`);
  const list = await res.json();
  const el = document.getElementById('myList');
  if (list.length === 0) { el.innerHTML = '<p class="empty-state">目前沒有申覆紀錄。</p>'; return; }

  const statusLabel = { pending: '待審核', approved: '已核准', rejected: '已駁回' };
  const statusColor = { pending: '#8a6d00', approved: 'var(--accent)', rejected: 'var(--danger)' };
  el.innerHTML = list.map((a) => `
    <div class="card">
      <div class="card-row">
        <span class="card-title">${a.work_date}・申覆成 ${a.requested_rooms} 間</span>
        <span class="badge" style="color:${statusColor[a.status]};">${statusLabel[a.status]}</span>
      </div>
      <p class="card-note">${a.reason}</p>
      ${a.status === 'rejected' && a.reject_reason ? `<p class="card-note" style="color:var(--danger);">駁回原因：${a.reject_reason}</p>` : ''}
    </div>`).join('');
}

// ---------- 店經理端：審核 ----------
async function loadPending() {
  const res = await fetch(`${API}/api/bonus-appeals/pending?branch_id=${staff.branch_id}`);
  const list = await res.json();
  const el = document.getElementById('pendingList');
  const pending = list.filter((a) => a.status === 'pending');
  if (pending.length === 0) { el.innerHTML = '<p class="empty-state">目前沒有待審核的申覆。</p>'; return; }

  el.innerHTML = '';
  for (const a of pending) {
    const statsRes = await fetch(`${API}/api/bonus-appeals/day-stats?staff_id=${a.staff_id}&branch_id=${staff.branch_id}&date=${a.work_date}`);
    const stats = await statsRes.json();

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-row"><span class="card-title">${a.staff?.name || ''}・${a.work_date}</span></div>
      <p class="card-note">申覆理由：${a.reason}</p>
      <div style="background:var(--surface-1);border-radius:8px;padding:8px;font-size:12.5px;margin:8px 0;">
        <p style="margin:0;">系統原算：淨間數 ${stats.net_rooms}、獎金 $${stats.bonus_amount}${stats.disqualified ? '（未達門檻）' : ''}</p>
        <p style="margin:4px 0 0;font-weight:600;color:var(--accent);">同仁申覆想改成：${a.requested_rooms} 間</p>
      </div>
      <div class="action-row"><button class="btn">核准（採用申覆的間數）</button><button class="danger-outline">駁回</button></div>`;
    const [approveBtn, rejectBtn] = card.querySelectorAll('button');
    approveBtn.addEventListener('click', () => decide(a.id, 'approved'));
    rejectBtn.addEventListener('click', () => openRejectOverlay(a.id));
    el.appendChild(card);
  }
}

function openRejectOverlay(id) {
  activeRejectId = id;
  document.getElementById('rejectReasonInput').value = '';
  document.getElementById('rejectOverlay').style.display = 'flex';
}
function closeRejectOverlay() {
  document.getElementById('rejectOverlay').style.display = 'none';
  activeRejectId = null;
}
async function confirmReject() {
  const reason = document.getElementById('rejectReasonInput').value.trim();
  if (!reason) { alert('請填駁回原因'); return; }
  await decide(activeRejectId, 'rejected', reason);
  closeRejectOverlay();
}

async function decide(id, status, rejectReason) {
  const res = await fetch(`${API}/api/bonus-appeals/${id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_by: staff.id, status, reject_reason: rejectReason }),
  });
  if (!res.ok) { alert((await res.json()).error || '操作失敗'); return; }
  loadPending();
}
