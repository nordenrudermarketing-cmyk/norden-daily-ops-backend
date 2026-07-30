const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CATEGORY_LABEL = { common: '全部門共同自檢項目', management: '主管職專屬自檢項目', housekeeping: '房務部門專屬自檢項目', frontdesk: '客務部門專屬自檢項目' };

document.getElementById('saveDraftBtn').addEventListener('click', () => save(false));
document.getElementById('submitBtn').addEventListener('click', () => save(true));

let formData = null;

load();

async function load() {
  const res = await fetch(`${API}/api/self-eval/form?staff_id=${staff.id}`);
  formData = await res.json();

  document.getElementById('staffLine').textContent = `${formData.staff.name}・評核月份：${formData.eval_month.slice(0, 7)}`;

  const isSubmitted = formData.submission?.status === 'submitted' || formData.submission?.status === 'reviewed';
  const today = new Date().toISOString().slice(0, 10);
  const overdue = today > formData.due_date && !isSubmitted;

  const dueBanner = document.getElementById('dueBanner');
  dueBanner.innerHTML = `<div class="due-banner${overdue ? ' overdue' : ''}">請於 ${formData.due_date} 前完成並送出（評核上個月 ${formData.eval_month.slice(0, 7)} 的工作表現）${overdue ? '・已逾期，請儘速送出' : ''}</div>`;

  const statusBanner = document.getElementById('statusBanner');
  if (isSubmitted) {
    statusBanner.innerHTML = `<div class="due-banner">已送出（${formData.submission.status === 'reviewed' ? '主管已審閱' : '等待主管審閱'}），以下內容僅供查看</div>`;
  } else {
    statusBanner.innerHTML = '';
  }

  renderQuestions(isSubmitted);
  document.getElementById('signOffArea').style.display = isSubmitted ? 'none' : 'block';
}

function renderQuestions(readonly) {
  const listEl = document.getElementById('questionsList');
  listEl.innerHTML = '';
  let lastCategory = null;

  formData.questions.forEach((q) => {
    if (q.category !== lastCategory) {
      const title = document.createElement('div');
      title.className = 'unit-group-title';
      title.style.cssText = 'font-size:13px;font-weight:600;color:var(--ink-soft);margin:18px 0 8px;';
      title.textContent = CATEGORY_LABEL[q.category] || q.category;
      listEl.appendChild(title);
      lastCategory = q.category;
    }

    const card = document.createElement('div');
    card.className = 'q-card';
    card.dataset.templateId = q.id;

    const bilingual = q.question_id ? `<p style="font-size:12px;color:var(--ink-soft);margin:0 0 10px;">${q.question_id}</p>` : '';

    if (readonly) {
      const ans = q.answer;
      card.innerHTML = `
        <p class="q-text">${q.question_zh}</p>
        ${bilingual}
        <div class="locked-note">人員自檢：${ans?.staff_answer === 'yes' ? '是' : ans?.staff_answer === 'no' ? '否' : '—'}${ans?.staff_note ? '　說明：' + ans.staff_note : ''}</div>`;
    } else {
      const ans = q.answer;
      card.innerHTML = `
        <p class="q-text">${q.question_zh}</p>
        ${bilingual}
        <div class="q-yesno">
          <label><input type="radio" name="ans-${q.id}" value="yes" ${ans?.staff_answer === 'yes' ? 'checked' : ''}> 是</label>
          <label><input type="radio" name="ans-${q.id}" value="no" ${ans?.staff_answer === 'no' ? 'checked' : ''}> 否</label>
        </div>
        <textarea class="q-note" placeholder="勾選「否」時請簡要說明原因、改善方式或需要的協助">${ans?.staff_note || ''}</textarea>`;
    }
    listEl.appendChild(card);
  });
}

async function save(submit) {
  const answers = [];
  document.querySelectorAll('.q-card').forEach((card) => {
    const templateId = card.dataset.templateId;
    const checked = card.querySelector(`input[name="ans-${templateId}"]:checked`);
    const note = card.querySelector('.q-note');
    if (checked) {
      answers.push({ template_id: templateId, staff_answer: checked.value, staff_note: note ? note.value : '' });
    }
  });

  if (submit && answers.length < formData.questions.length) {
    if (!confirm('還有題目沒有勾選，確定要送出嗎？')) return;
  }

  const btn = submit ? document.getElementById('submitBtn') : document.getElementById('saveDraftBtn');
  const originalText = btn.textContent;
  btn.textContent = '處理中…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/self-eval/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staff.id,
        branch_id: staff.branch_id,
        eval_month: formData.eval_month,
        answers,
        submit,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '儲存失敗');
    document.getElementById('statusMsg').style.color = 'var(--accent)';
    document.getElementById('statusMsg').textContent = submit ? '已送出，感謝完成本月自評！' : '草稿已儲存';
    if (submit) load();
  } catch (err) {
    document.getElementById('statusMsg').style.color = 'var(--danger)';
    document.getElementById('statusMsg').textContent = err.message;
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
