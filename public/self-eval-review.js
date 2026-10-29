// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const STATUS_LABEL = { none: '尚未填寫', draft: '填寫中（草稿）', submitted: '待面談', reviewed: '已完成面談' };
const CATEGORY_LABEL = { common: '全部門共同自檢項目', management: '主管職專屬自檢項目', housekeeping: '房務部門專屬自檢項目', frontdesk: '客務部門專屬自檢項目' };

const $ = (id) => document.getElementById(id);
const monthInput = $('monthInput');

// 目前這個月份的時程：{ eval_month, staff_due_date, interview_due_date, today }，由伺服器依台灣時間計算
let schedule = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// '2026-08' → '2026 年 8 月'
function monthLabel(yearMonth) {
  const [y, m] = yearMonth.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

async function fetchSchedule(evalMonth) {
  const qs = evalMonth ? `?eval_month=${evalMonth}` : '';
  const res = await fetch(`${API}/api/self-eval/schedule${qs}`);
  if (!res.ok) throw new Error('無法取得自評表時程');
  return res.json();
}

monthInput.addEventListener('change', loadList);
$('backToList').addEventListener('click', loadList);
$('showAll').addEventListener('change', loadList);

if (staff) init();

async function init() {
  $('staffLine').textContent = staff.name;
  // 總公司可以切換「顯示全部同仁」，替不在自己管轄內的同仁面談（備援）
  if (staff.roles?.name === '總公司') $('showAllWrap').style.display = '';
  try {
    schedule = await fetchSchedule();
    monthInput.value = schedule.eval_month.slice(0, 7);
  } catch (err) {
    // 拿不到時程就退回用瀏覽器時間推算上個月
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  loadList();
}

function lateLabel(status) {
  if (!schedule) return '';
  if ((status === 'none' || status === 'draft') && schedule.today > schedule.staff_due_date) return '逾期未送出';
  if (status === 'submitted' && schedule.today > schedule.interview_due_date) return '面談逾期';
  return '';
}

async function loadList() {
  $('listView').style.display = 'block';
  $('detailWrap').style.display = 'none';
  $('pageTitle').textContent = '審閱自評表';
  if (!monthInput.value) return;

  const evalMonth = `${monthInput.value}-01`;
  const listEl = $('staffList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';
  $('scheduleBanner').innerHTML = '';

  // 我管轄的同仁（總公司勾「顯示全部同仁」時是全部在職同仁），已經依館別、姓名排好
  const scope = $('showAll').checked ? 'all' : 'mine';
  let data;
  try {
    const [sched, res] = await Promise.all([
      fetchSchedule(evalMonth),
      fetch(`${API}/api/self-eval/my-reviewees?eval_month=${evalMonth}&scope=${scope}`),
    ]);
    schedule = sched;
    data = await res.json();
    if (!res.ok) throw new Error(data.error || '載入失敗');
  } catch (err) {
    listEl.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    return;
  }

  const total = data.length;
  const submittedCount = data.filter((s) => ['submitted', 'reviewed'].includes(s.submission?.status)).length;
  const reviewedCount = data.filter((s) => s.submission?.status === 'reviewed').length;
  const staffPassed = schedule.today > schedule.staff_due_date;
  const interviewPassed = schedule.today > schedule.interview_due_date;
  const needsAttention = (staffPassed && submittedCount < total) || (interviewPassed && reviewedCount < total);

  $('scheduleBanner').innerHTML = `
    <div class="schedule-banner ${needsAttention ? 'overdue' : ''}">
      評核 ${monthLabel(monthInput.value)}：同仁 <strong>${schedule.staff_due_date}</strong> 前送出，主管請於 <strong>${schedule.interview_due_date}</strong> 前完成面談<br>
      已送出 ${submittedCount} / ${total}・已完成面談 ${reviewedCount} / ${total}${interviewPassed && reviewedCount < total ? '・<strong>已超過面談期限</strong>' : ''}
    </div>`;

  listEl.innerHTML = '';
  if (total === 0) {
    listEl.innerHTML = scope === 'all'
      ? '<p class="empty-state">目前沒有在職同仁</p>'
      : '<p class="empty-state">目前沒有指定給你管轄的同仁，需要的話請總公司在「帳號管理」設定</p>';
    return;
  }

  let lastBranch = null;
  data.forEach((s) => {
    if (s.branch_name !== lastBranch) {
      lastBranch = s.branch_name;
      const title = document.createElement('p');
      title.className = 'branch-title';
      title.textContent = s.branch_name;
      listEl.appendChild(title);
    }

    const status = s.submission?.status || 'none';
    const canOpen = status === 'submitted' || status === 'reviewed';
    const late = lateLabel(status);
    const submittedOn = canOpen && s.submission.submitted_at
      ? `・${new Date(s.submission.submitted_at).toLocaleDateString('zh-TW')} 送出`
      : '';
    // 一位同仁可能有多位主管：列出其他主管，並標出是誰完成面談、誰最後存了面談進度
    const others = (s.supervisor_names || []).filter((n) => n !== staff.name);
    const extra = [];
    if (status === 'reviewed' && s.submission.reviewed_by_name) extra.push(`由 ${s.submission.reviewed_by_name} 完成面談`);
    else if (status === 'submitted' && s.submission.last_edited_by_name) extra.push(`${s.submission.last_edited_by_name} 已開始面談`);
    if (others.length) extra.push(`其他主管：${others.join('、')}`);
    if (!s.supervisor_names?.length) extra.push('未指定主管');

    const row = document.createElement('div');
    row.className = 'staff-row';
    row.innerHTML = `
      <div>
        <p style="margin:0;font-size:14px;font-weight:500;">${escapeHtml(s.name)}${scope === 'all' && !s.is_mine ? '<span class="tag-other">非我管轄</span>' : ''}</p>
        <p class="meta-line">${escapeHtml(s.role_name || '')}${submittedOn}</p>
        ${extra.length ? `<p class="meta-line">${escapeHtml(extra.join('・'))}</p>` : ''}
      </div>
      <div class="row-right">
        ${late ? `<span class="late-tag">${late}</span>` : ''}
        <span class="status ${status}">${STATUS_LABEL[status]}</span>
      </div>`;

    // 面談是在同仁送出之後才進行，還沒送出的表不開放點進去
    if (canOpen) {
      row.addEventListener('click', () => openDetail(s.submission.id, s.name));
    } else {
      row.style.cursor = 'default';
      row.style.opacity = '0.65';
    }
    listEl.appendChild(row);
  });
}

async function openDetail(submissionId, staffName) {
  $('listView').style.display = 'none';
  $('detailWrap').style.display = 'block';
  const detailView = $('detailView');
  detailView.innerHTML = '<p class="empty-state">載入中…</p>';
  $('pageTitle').textContent = `${staffName} 的自評表`;
  window.scrollTo(0, 0);

  const res = await fetch(`${API}/api/self-eval/submission-detail?submission_id=${submissionId}`);
  const data = await res.json();
  if (!res.ok) {
    detailView.innerHTML = `<p class="empty-state">${escapeHtml(data.error || '載入失敗')}</p>`;
    return;
  }
  renderDetail(data);
}

function renderDetail(data) {
  const { submission, answers } = data;
  // 已完成面談、或我已經不是他的主管（只是以前面談過、來看歷史紀錄）時只能看不能改
  const isReviewed = submission.status === 'reviewed' || submission.can_review === false;
  const detailView = $('detailView');
  detailView.innerHTML = '';

  const ym = submission.eval_month.slice(0, 7);
  const submittedOn = submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString('zh-TW') : '—';
  const interviewOverdue = !isReviewed && schedule && schedule.today > schedule.interview_due_date;

  const info = document.createElement('div');
  info.className = `schedule-banner${interviewOverdue ? ' overdue' : ''}`;
  const reviewer = submission.reviewed_by_name ? `由 ${escapeHtml(submission.reviewed_by_name)} ` : '';
  const supervisors = submission.supervisor_names?.length ? `<br>主管：${escapeHtml(submission.supervisor_names.join('、'))}` : '';
  const lastEdit = !isReviewed && submission.last_edited_by_name
    ? `<br>面談進度上次由 ${escapeHtml(submission.last_edited_by_name)} 儲存，多位主管共用同一份面談紀錄`
    : '';
  info.innerHTML = (submission.status === 'reviewed'
    ? `評核 ${monthLabel(ym)}・同仁 ${submittedOn} 送出・${reviewer}已完成面談`
    : `評核 ${monthLabel(ym)}・同仁 ${submittedOn} 送出・請於 <strong>${schedule?.interview_due_date || '20 號'}</strong> 前完成面談${interviewOverdue ? '（已超過期限）' : ''}`) +
    supervisors + lastEdit;
  detailView.appendChild(info);

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
    const staffBox = `<div class="staff-answer-box">人員自檢：${staffAnswerText}${a.staff_note ? '　說明：' + escapeHtml(a.staff_note) : ''}</div>`;

    if (isReviewed) {
      card.innerHTML = `
        <p class="q-text">${escapeHtml(a.template.question_zh)}</p>
        ${staffBox}
        <div class="staff-answer-box">主管確認：${a.manager_answer === 'yes' ? '是' : a.manager_answer === 'no' ? '否' : '—'}${a.manager_note ? '　說明：' + escapeHtml(a.manager_note) : ''}</div>`;
    } else {
      card.innerHTML = `
        <p class="q-text">${escapeHtml(a.template.question_zh)}</p>
        ${staffBox}
        <p style="font-size:12px;color:var(--ink-soft);margin:0 0 6px;">主管確認</p>
        <div class="q-yesno">
          <label><input type="radio" name="mgr-${a.template_id}" value="yes" ${a.manager_answer === 'yes' ? 'checked' : ''}> 是</label>
          <label><input type="radio" name="mgr-${a.template_id}" value="no" ${a.manager_answer === 'no' ? 'checked' : ''}> 否</label>
        </div>
        <textarea class="q-note" placeholder="說明">${escapeHtml(a.manager_note || '')}</textarea>`;
    }
    detailView.appendChild(card);
  });

  const footer = document.createElement('div');
  if (isReviewed) {
    footer.innerHTML = `
      <div class="q-card">
        <p style="font-weight:500;margin:0 0 6px;">主管面談及改善追蹤紀錄</p>
        <p style="font-size:13px;white-space:pre-wrap;">${escapeHtml(submission.manager_interview_notes || '（無）')}</p>
        <p style="font-size:12px;color:var(--ink-soft);margin-top:8px;">面談日期：${escapeHtml(submission.interview_date || '—')}・${submission.status === 'reviewed' ? `${reviewer}已完成面談${submission.reviewed_by_name ? '' : '（管轄功能上線前完成，沒有記錄面談主管）'}` : '尚未完成面談'}</p>
      </div>`;
  } else {
    const defaultDate = submission.interview_date || schedule?.today || '';
    footer.innerHTML = `
      <div class="q-card">
        <p style="font-weight:500;margin:0 0 8px;">主管面談及改善追蹤紀錄</p>
        <textarea class="q-note" id="interviewNotes" style="min-height:80px;" placeholder="面談內容、雙方約定的改善方式與追蹤時間">${escapeHtml(submission.manager_interview_notes || '')}</textarea>
        <div class="field" style="margin-top:8px;max-width:200px;"><label for="interviewDate">面談日期</label><input type="date" id="interviewDate" value="${escapeHtml(defaultDate)}"></div>
        <div class="action-row" style="margin-top:10px;">
          <button class="secondary" id="saveReviewBtn">儲存面談進度</button>
          <button class="btn" id="completeReviewBtn">完成面談</button>
        </div>
        <p id="reviewMsg" style="font-size:12px;margin:8px 0 0;min-height:16px;"></p>
      </div>`;
  }
  detailView.appendChild(footer);

  if (!isReviewed) {
    $('saveReviewBtn').addEventListener('click', () => submitReview(submission.id, false));
    $('completeReviewBtn').addEventListener('click', () => submitReview(submission.id, true));
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

  if (markReviewed && !confirm('完成面談後這份表就會鎖定，確定要完成嗎？')) return;

  const msg = $('reviewMsg');
  msg.style.color = 'var(--ink-soft)';
  msg.textContent = '儲存中…';

  try {
    const res = await fetch(`${API}/api/self-eval/manager-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submissionId,
        answers,
        interview_notes: $('interviewNotes')?.value || '',
        interview_date: $('interviewDate')?.value || null,
        mark_reviewed: markReviewed,
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '儲存失敗');
  } catch (err) {
    msg.style.color = 'var(--danger)';
    msg.textContent = err.message;
    return;
  }

  if (markReviewed) {
    loadList(); // 回列表，可以看到這位同仁變成「已完成面談」
  } else {
    msg.style.color = 'var(--accent)';
    msg.textContent = '已儲存面談進度';
  }
}
