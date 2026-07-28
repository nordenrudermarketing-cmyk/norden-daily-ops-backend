const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
const roleName = staff.roles?.name || '';
const myShift = staff.todayShiftCode || roleName.replace('客務', '').replace('班', '');

document.getElementById('dateLine').textContent = today;
if (['A', 'B', 'C'].includes(myShift)) document.getElementById('shiftCode').value = myShift;

document.getElementById('shiftCode').addEventListener('change', loadExisting);
document.getElementById('addFieldBtn').addEventListener('click', () => addCustomFieldRow('', ''));
document.getElementById('submitBtn').addEventListener('click', submit);

init();

async function init() {
  await prefillFacilityNote();
  await loadExisting();
}

// 抓今天所有任務回報的異常，組成參考文字帶入公區/客房設備異常回報欄位
async function prefillFacilityNote() {
  try {
    const res = await fetch(`${API}/api/handover/defects-today?branch_id=${staff.branch_id}&date=${today}`);
    const defects = await res.json();
    const noteEl = document.getElementById('facilityNote');
    if (defects.length === 0) {
      noteEl.value = '無';
    } else {
      noteEl.value = defects
        .map((d) => `・${d.description}（${d.staff?.name || ''}・${new Date(d.reported_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}）`)
        .join('\n');
    }
  } catch (err) {
    // 抓不到就留空白讓同仁自己填，不擋住整個表單
  }
}

// 如果今天這一班已經填過，載入既有內容讓同仁編輯（不會覆蓋掉剛剛自動帶入的異常回報，除非已存檔過）
async function loadExisting() {
  const shiftCode = document.getElementById('shiftCode').value;
  const res = await fetch(`${API}/api/handover/today?branch_id=${staff.branch_id}&date=${today}&shift_code=${shiftCode}`);
  const existing = await res.json();
  if (!existing) return;

  document.getElementById('handoverStaff').value = existing.handover_staff || '';
  document.getElementById('nextShiftStaff').value = existing.next_shift_staff || '';
  document.getElementById('checkinCount').value = existing.checkin_count ?? '';
  document.getElementById('checkoutExpected').value = existing.checkout_expected_count ?? '';
  document.getElementById('lateCheckin').value = existing.late_checkin_rooms || '';
  document.getElementById('billingNote').value = existing.billing_anomaly_note || '';
  document.getElementById('cardCheck').value = existing.card_handover_check || '';
  document.getElementById('pendingItems').value = existing.pending_items || '';
  document.getElementById('facilityNote').value = existing.facility_issue_note || '';
  document.getElementById('complaintNote').value = existing.complaint_note || '';
  document.getElementById('cashTotal').value = existing.cash_total ?? '';
  document.getElementById('receiptTotal').value = existing.receipt_total ?? '';

  document.getElementById('customFields').innerHTML = '';
  Object.entries(existing.extra_fields || {}).forEach(([k, v]) => addCustomFieldRow(k, v));
}

function addCustomFieldRow(label, value) {
  const row = document.createElement('div');
  row.className = 'custom-row';
  row.innerHTML = `
    <div class="field"><input type="text" class="custom-label" placeholder="欄位名稱" value="${label}"></div>
    <div class="field"><input type="text" class="custom-value" placeholder="內容" value="${value}"></div>
    <button type="button" class="remove-btn">✕</button>`;
  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  document.getElementById('customFields').appendChild(row);
}

async function submit() {
  const extraFields = {};
  document.querySelectorAll('#customFields .custom-row').forEach((row) => {
    const label = row.querySelector('.custom-label').value.trim();
    const value = row.querySelector('.custom-value').value.trim();
    if (label) extraFields[label] = value;
  });

  const payload = {
    branch_id: staff.branch_id,
    work_date: today,
    shift_code: document.getElementById('shiftCode').value,
    handover_staff: document.getElementById('handoverStaff').value,
    next_shift_staff: document.getElementById('nextShiftStaff').value,
    checkin_count: Number(document.getElementById('checkinCount').value) || null,
    checkout_expected_count: Number(document.getElementById('checkoutExpected').value) || null,
    late_checkin_rooms: document.getElementById('lateCheckin').value,
    billing_anomaly_note: document.getElementById('billingNote').value,
    card_handover_check: document.getElementById('cardCheck').value,
    pending_items: document.getElementById('pendingItems').value,
    facility_issue_note: document.getElementById('facilityNote').value,
    complaint_note: document.getElementById('complaintNote').value,
    cash_total: Number(document.getElementById('cashTotal').value) || null,
    receipt_total: Number(document.getElementById('receiptTotal').value) || null,
    extra_fields: extraFields,
    submitted_by: staff.id,
  };

  const btn = document.getElementById('submitBtn');
  btn.textContent = '送出中…';
  btn.disabled = true;
  const statusMsg = document.getElementById('statusMsg');
  statusMsg.textContent = '';

  try {
    const res = await fetch(`${API}/api/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error || '送出失敗');
    statusMsg.style.color = 'var(--accent)';
    statusMsg.textContent = '已送出，感謝辛苦了！';
  } catch (err) {
    statusMsg.style.color = 'var(--danger)';
    statusMsg.textContent = err.message;
  } finally {
    btn.textContent = '送出交班表';
    btn.disabled = false;
  }
}
