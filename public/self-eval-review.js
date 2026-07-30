const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const STATUS_LABEL = { none: '尚未開始', draft: '草稿中', submitted: '待審閱', reviewed: '已審閱' };
const CATEGORY_LABEL = { common: '全部門共同自檢項目', management: '主管職專屬自檢項目', housekeeping: '房務部門專屬自檢項目', frontdesk: '客務部門專屬自檢項目' };

function prevMonthStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

const monthInput = document.getElementById('monthInput');
monthInput.value = prevMonthStr();
monthInput.addEventListener('change', loadList);

document.getElementById('staffLine').textContent = staff.name;

loadList();

async function loadList() {
  document.getElementById('listView').style.display = 'block';
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('pageTitle').textContent = '審閱自評表';
  document.getElementById('backLink').textContent = '回總覽';
  document.getElementById('backLink').href = 'dashboard.html';

  const evalMonth = `${monthInput.value}-01`;
  const listEl = document.getElementById('staffList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/self-eval/branch-overview?branch_id=${staff.branch_id}&eval_month=${evalMonth}`);
  const data = await res.json();

  listEl.innerHTML = '';
  data.forEach((s) => {
    const status = s.submission?.status || 'none';
    const row = document.createElement('div');
    row.className = 'staff-row';
    row.innerHTML = `
      <div>
        <p style="margin:0;font-size:14px;font-weight:500;">${s.name}</p>
        <p style="margin:2px 0 0;font-size:12px;color:var(--ink-soft);">${s.role_name || ''}</p>
      </div>
      <span class="status ${status}">${STATUS_LABEL[status]}</span>`;
    if (s.submission) {
      row.addEventListener('click', () => openDetail(s.submission.id, s.name));
    } else {
      row.style.cursor = 'default';
      row.style.opacity = '0.6';
    }
    listEl.appendChild(row);
  });
}

async function openDetail(submissionId, staffName) {
  document.getElementById('listView').style.display = 'none';
  const detailView = document.getElementById('detailView');
  detailView.style.display = 'block';
  detailView.innerHTML = '<p class="empty-state">載入中…</p>';
  document.getElementById('pageTitle').textContent = `${staffName} 的自評表`;
  document.getElementById('backLink').textContent = '← 回列表';
  document.getElementById('backLink').removeAttribute('href');
  document.getElementById('backLink').addEventListener('click', (e) => { e.preventDefault(); loadList(); });

  const res = await fetch(`${API}/api/self-eval/submission-detail?submission_id=${submissionId}`);
  const data = await res.json();
  renderDetail(data);
}

function renderDetail(data) {
  const { submission, answers } = data;
  const isReviewed = submission.status === 'reviewed';
  const detailView = document.getElementById('detailView');
  detailView.innerHTML = '';

  let lastCategory = null;
  answers.forEach((a) => {
    if (a.template.category !== lastCategory) {
      const title = document.createElement('div');
      title.style.cssText = 'font-size:13px;font-weight:600;color:var(--ink-soft);margin:18px 0 8px;';
      title.textContent = CATEGORY_LABEL[a.template.category] || a.template.category;
      detailView.appendChild(title);
      lastCategory = a.template.category;
    }

    const card = document.createElement('div');
    card.className = 'q-card';
    card.dataset.templateId = a.template_id;

    const staffAnswerText = a.staff_answer === 'yes' ? '是' : a.staff_answer === 'no' ? '否' : '未作答';

    if (isReviewed) {
      card.innerHTML = `
        <p class="q-text">${a.template.question_zh}</p>
        <div class="staff-answer-box">人員自檢：${staffAnswerText}${a.staff_note ? '　說明：' + a.staff_note : ''}</div>
        <div class="staff-answer-box">主管確認：${a.manager_answer === 'yes' ? '是' : a.manager_answer === 'no' ? '否' : '—'}${a.manager_note ? '　說明：' + a.manager_note : ''}</div>`;
    } else {
      card.innerHTML = `
        <p class="q-text">${a.template.question_zh}</p>
        <div class="staff-answer-box">人員自檢：${staffAnswerText}${a.staff_note ? '　說明：' + a.staff_note : ''}</div>
        <p style="font-size:12px;color:var(--ink-soft);margin:0 0 6px;">主管確認</p>
        <div class="q-yesno">
          <label><input type="radio" name="mgr-${a.template_id}" value="yes" ${a.manager_answer === 'yes' ? 'checked' : ''}> 是</label>
          <label><input type="radio" name="mgr-${a.template_id}" value="no" ${a.manager_answer === 'no' ? 'checked' : ''}> 否</label>
        </div>
        <textarea class="q-note" placeholder="說明">${a.manager_note || ''}</textarea>`;
    }
    detailView.appendChild(card);
  });

  const footer = document.createElement('div');
  if (isReviewed) {
    footer.innerHTML = `
      <div class="q-card">
        <p style="font-weight:500;margin:0 0 6px;">主管面談及改善追蹤紀錄</p>
        <p style="font-size:13px;white-space:pre-wrap;">${submission.manager_interview_notes || '（無）'}</p>
        <p style="font-size:12px;color:var(--ink-soft);margin-top:8px;">面談日期：${submission.interview_date || '—'}・已完成審閱</p>
      </div>`;
  } else {
    footer.innerHTML = `
      <div class="q-card">
        <p style="font-weight:500;margin:0 0 8px;">主管面談及改善追蹤紀錄</p>
        <textarea class="q-note" id="interviewNotes" style="min-height:80px;">${submission.manager_interview_notes || ''}</textarea>
        <div class="field" style="margin-top:8px;max-width:200px;"><label for="interviewDate">面談日期</label><input type="text" id="interviewDate" value="${submission.interview_date || ''}" placeholder="YYYY-MM-DD"></div>
        <div class="action-row" style="margin-top:10px;">
          <button class="secondary" id="saveReviewBtn">儲存審閱進度</button>
          <button class="btn" id="completeReviewBtn">完成審閱</button>
        </div>
      </div>`;
  }
  detailView.appendChild(footer);

  if (!isReviewed) {
    document.getElementById('saveReviewBtn').addEventListener('click', () => submitReview(submission.id, false));
    document.getElementById('completeReviewBtn').addEventListener('click', () => submitReview(submission.id, true));
  }
}

async function submitReview(submissionId, markReviewed) {
  const answers = [];
  document.querySelectorAll('#detailView .q-card[data-template-id]').forEach((card) => {
    const templateId = card.dataset.templateId;
    const checked = card.querySelector(`input[name="mgr-${templateId}"]:checked`);
    const note = card.querySelector('.q-note');
    if (checked) answers.push({ template_id: templateId, manager_answer: checked.value, manager_note: note ? note.value : '' });
  });

  if (markReviewed && !confirm('完成審閱後這份表就會鎖定，確定要完成嗎？')) return;

  await fetch(`${API}/api/self-eval/manager-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submission_id: submissionId,
      answers,
      interview_notes: document.getElementById('interviewNotes')?.value || '',
      interview_date: document.getElementById('interviewDate')?.value || null,
      mark_reviewed: markReviewed,
    }),
  });

  alert(markReviewed ? '已完成審閱' : '已儲存審閱進度');
  openDetail(submissionId, document.getElementById('pageTitle').textContent.replace(' 的自評表', ''));
}
