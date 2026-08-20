const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const today = new Date().toISOString().slice(0, 10);
document.getElementById('staffLine').textContent = `${staff.name}・${today}`;
document.getElementById('saveBtn').addEventListener('click', save);

load();

async function load() {
  const res = await fetch(`${API}/api/manager-worksheet/form?staff_id=${staff.id}&date=${today}`);
  const data = await res.json();

  if (data.submission) {
    document.getElementById('statusBanner').innerHTML = '<div class="due-banner" style="background:var(--accent-soft);border:1px solid #b9d3c5;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--accent);">今天已經送出過，重新送出會覆蓋原本內容</div>';
    document.getElementById('shiftType').value = data.submission.shift_type || '主管班';
    document.getElementById('checkinTime').value = data.submission.checkin_time || '';
    document.getElementById('inspectionItems').value = data.submission.inspection_items || '';
    document.getElementById('inspectionResult').value = data.submission.inspection_result || '';
    document.getElementById('yesterdayPending').value = data.submission.yesterday_pending || '';
    document.getElementById('todayCompleted').value = data.submission.today_completed || '';
    document.getElementById('todayPending').value = data.submission.today_pending || '';
    document.getElementById('cashCheckNote').value = data.submission.cash_check_note || '';
    document.getElementById('orderNumbers').value = data.submission.order_numbers || '';
    document.getElementById('processImprovement').value = data.submission.process_improvement || '';
    document.getElementById('serviceIssueNote').value = data.submission.service_issue_note || '';
    document.getElementById('otherNotes').value = data.submission.other_notes || '';
  }

  renderChecklist(data.items);
}

function renderChecklist(items) {
  const el = document.getElementById('checklistArea');
  el.innerHTML = '';
  let lastSection = null;

  items.forEach((it) => {
    if (it.section !== lastSection) {
      const title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = it.section;
      el.appendChild(title);
      lastSection = it.section;
    }
    const row = document.createElement('div');
    row.className = 'check-item';
    row.innerHTML = `
      <input type="checkbox" id="chk-${it.id}" data-template-id="${it.id}" ${it.checked ? 'checked' : ''}>
      <label for="chk-${it.id}">${it.item_text}</label>`;
    el.appendChild(row);
  });
}

async function save() {
  const checkedItems = [];
  document.querySelectorAll('[data-template-id]').forEach((cb) => {
    checkedItems.push({ template_id: cb.dataset.templateId, checked: cb.checked });
  });

  const btn = document.getElementById('saveBtn');
  btn.textContent = '送出中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/manager-worksheet/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staff.id,
        branch_id: staff.branch_id,
        work_date: today,
        shift_type: document.getElementById('shiftType').value,
        checkin_time: document.getElementById('checkinTime').value,
        inspection_items: document.getElementById('inspectionItems').value,
        inspection_result: document.getElementById('inspectionResult').value,
        yesterday_pending: document.getElementById('yesterdayPending').value,
        today_completed: document.getElementById('todayCompleted').value,
        today_pending: document.getElementById('todayPending').value,
        cash_check_note: document.getElementById('cashCheckNote').value,
        order_numbers: document.getElementById('orderNumbers').value,
        process_improvement: document.getElementById('processImprovement').value,
        service_issue_note: document.getElementById('serviceIssueNote').value,
        other_notes: document.getElementById('otherNotes').value,
        checked_items: checkedItems,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '送出失敗');
    document.getElementById('statusMsg').style.color = 'var(--accent)';
    document.getElementById('statusMsg').textContent = '已送出，感謝完成今日工作日報表！';
  } catch (err) {
    document.getElementById('statusMsg').style.color = 'var(--danger)';
    document.getElementById('statusMsg').textContent = err.message;
  } finally {
    btn.textContent = '送出工作日報表';
    btn.disabled = false;
  }
}
