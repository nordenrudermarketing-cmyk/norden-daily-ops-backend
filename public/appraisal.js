// 每月評核：這個月我要評分的同仁（名單由後端依帳號、部門、管轄算出來，見 gas/Appraisal.gs）
// 主管評分時可以打開這位同仁當月的自評和面談紀錄；現場正職另外填「回饋與期望」

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const $ = (id) => document.getElementById(id);

let data = null;      // /api/appraisal/mine 的結果
let openId = null;    // 目前展開的同仁
const selfEvalCache = {};

if (!staff) {
  window.location.href = 'index.html';
} else {
  $('staffLine').textContent = staff.name;
  load();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const monthText = (m) => `${m.slice(0, 4)} 年 ${Number(m.slice(5, 7))} 月`;
const shortDate = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const POINTS = { A: 100, B: 80, C: 60, D: 0 };

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || '操作失敗，請稍後再試');
  return result;
}

async function load() {
  try {
    data = await api('/api/appraisal/mine');
  } catch (err) {
    $('list').innerHTML = '';
    $('statusLine').textContent = err.message;
    return;
  }
  renderBanner();
  render();
  renderFeedback();
}

function renderBanner() {
  const w = data.window;
  const range = `${shortDate(w.open_date)}～${shortDate(w.close_date)}`;
  let cls = '';
  let text;
  if (w.state === 'open') {
    text = `${monthText(w.eval_month)}評核開放中（${range}），請在 ${shortDate(w.close_date)} 前完成。`;
  } else if (w.state === 'upcoming') {
    cls = 'warn';
    text = `${monthText(w.eval_month)}評核 ${shortDate(w.open_date)} 開放評分（${range}），可以先看名單。`;
  } else {
    cls = 'muted';
    text = `${monthText(w.eval_month)}評核已經在 ${shortDate(w.close_date)} 截止。`;
  }
  if (w.testing_override) text += '<br>測試站：不受開放時間限制，現在就可以評分。';
  text += '<br>每一項選 A～D；留言會<b>具名</b>讓對方看到，請具體寫出值得肯定和可以更好的地方。';
  $('windowBanner').innerHTML = `<div class="banner ${cls}">${text}</div>`;
}

function render() {
  const list = data.ratees;
  if (data.required_total) {
    $('progressLine').innerHTML = `需要評分 <b>${data.required_total}</b> 人，已完成 <b>${data.required_done}</b> 人`;
  } else {
    $('progressLine').textContent = '';
  }

  if (list.length === 0) {
    $('list').innerHTML = data.is_junior
      ? '<p class="empty-state">兼職、實習生不用幫別人評分。<br>評核結果發布後，會在這裡看到自己的評核表。</p>'
      : '<p class="empty-state">你這個月沒有需要評分的同仁。<br>如果覺得名單不對，請洽總公司確認管轄設定。</p>';
    return;
  }

  const required = list.filter((r) => r.required);
  const suggested = list.filter((r) => !r.required && r.suggested);
  const optional = list.filter((r) => !r.required && !r.suggested);
  const todoFirst = (a, b) => Number(a.done) - Number(b.done);

  let html = '';
  if (required.length) {
    html += `<h2 class="sec-title">需要你評分<small>${required.filter((r) => r.done).length}/${required.length}</small></h2>`;
    html += required.slice().sort(todoFirst).map(card).join('');
  }
  if (suggested.length) {
    html += `<h2 class="sec-title">建議評分<small>${suggested.filter((r) => r.done).length}/${suggested.length}</small></h2>
      <p class="sec-hint">主管，以及沒有其他人評分的同仁（例如品牌、咖啡廳），主要靠總辦公室評分。</p>`;
    html += suggested.slice().sort(todoFirst).map(card).join('');
  }
  if (optional.length) {
    html += '<h2 class="sec-title">選填</h2><p class="sec-hint">其他同仁已經有主管評分，總辦公室想補充時再評。</p>';
    const byBranch = {};
    optional.forEach((r) => { (byBranch[r.branch_name] = byBranch[r.branch_name] || []).push(r); });
    Object.keys(byBranch).forEach((branch) => {
      const people = byBranch[branch];
      const opened = people.some((r) => r.staff_id === openId);
      html += `<details class="group" ${opened ? 'open' : ''}><summary>${escapeHtml(branch)}（${people.filter((r) => r.done).length}/${people.length}）</summary>
        ${people.map(card).join('')}</details>`;
    });
  }
  $('list').innerHTML = html;
  bindCards();
}

function card(r) {
  const isOpen = r.staff_id === openId;
  const status = r.done
    ? '<span class="st done">已評分</span>'
    : r.required ? '<span class="st todo">待評分</span>' : '<span class="st opt">未評</span>';
  const tags = r.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  return `
    <div class="person ${isOpen ? 'open' : ''}" data-id="${r.staff_id}">
      <button type="button" class="person-head" data-act="toggle" aria-expanded="${isOpen}">
        <div class="who">
          <div class="name">${escapeHtml(r.name)}${tags}</div>
          <div class="meta">${escapeHtml(r.branch_name)}${r.role_name ? '・' + escapeHtml(r.role_name) : ''}</div>
        </div>
        ${status}
      </button>
      ${isOpen ? body(r) : ''}
    </div>`;
}

function body(r) {
  const editable = data.can_rate_now;
  const grades = r.rating?.grades || {};
  const items = r.items.map((it) => {
    const guide = it.grade_desc || data.grade_guide;
    const options = ['A', 'B', 'C', 'D'].map((g) => `
      <label><input type="radio" name="g-${r.staff_id}-${it.id}" value="${g}" ${grades[it.id] === g ? 'checked' : ''} ${editable ? '' : 'disabled'}>
        <span>${g}<small>${POINTS[g]} 分</small></span></label>`).join('');
    return `
      <div class="item" data-item="${it.id}">
        <div class="item-name">${escapeHtml(it.name)}</div>
        ${it.description ? `<details class="desc"><summary>這一項看什麼</summary><p>${escapeHtml(it.description)}</p></details>` : ''}
        <details class="desc"><summary>A～D 怎麼選</summary><p>${escapeHtml(guide)}</p></details>
        <div class="grades">${options}</div>
      </div>`;
  }).join('');

  const selfEval = r.self_eval
    ? `<button type="button" class="self-eval-btn" data-act="self-eval">看 ${escapeHtml(r.name)} 這個月的自評和面談紀錄</button><div class="self-eval-slot"></div>`
    : '';
  const saved = r.rating?.updated_at ? `上次儲存：${new Date(r.rating.updated_at).toLocaleString('zh-TW', { hour12: false })}` : '';

  return `
    <div class="person-body">
      <p class="relation">${escapeHtml(r.relations.join('、'))}</p>
      ${selfEval}
      ${items}
      <label class="comment-label" for="c-${r.staff_id}">給 ${escapeHtml(r.name)} 的話（評核留言，會具名讓對方看到，選填）</label>
      <textarea id="c-${r.staff_id}" ${editable ? '' : 'disabled'} placeholder="例如：這個月做得好的地方、下個月可以更好的地方">${escapeHtml(r.rating?.comment || '')}</textarea>
      ${editable ? `<div class="action-row"><button type="button" class="btn" data-act="save">${r.rating ? '更新評分' : '送出評分'}</button></div>` : ''}
      <p class="save-msg" data-msg>${escapeHtml(saved)}</p>
    </div>`;
}

function bindCards() {
  $('list').querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.person').dataset.id;
      if (btn.dataset.act === 'toggle') {
        openId = openId === id ? null : id;
        render();
        if (openId) document.querySelector(`.person[data-id="${openId}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if (btn.dataset.act === 'save') {
        save(id, btn);
      } else if (btn.dataset.act === 'self-eval') {
        showSelfEval(id, btn);
      }
    });
  });
}

async function save(id, btn) {
  const r = data.ratees.find((x) => x.staff_id === id);
  const box = btn.closest('.person');
  const msg = box.querySelector('[data-msg]');
  const grades = {};
  const missing = [];
  r.items.forEach((it) => {
    const checked = box.querySelector(`input[name="g-${id}-${it.id}"]:checked`);
    if (checked) grades[it.id] = checked.value;
    else missing.push(it.name);
  });
  if (missing.length) {
    msg.className = 'save-msg err';
    msg.textContent = `請幫「${missing.join('、')}」選一個分數`;
    return;
  }
  btn.disabled = true;
  msg.className = 'save-msg';
  msg.textContent = '儲存中…';
  try {
    const result = await api('/api/appraisal/rate', 'POST', {
      ratee_id: id, grades, comment: box.querySelector('textarea').value,
    });
    const wasDone = r.done;
    r.rating = result.rating;
    r.done = true;
    if (r.required && !wasDone) data.required_done += 1;
    openId = null;
    render();
    $('statusLine').textContent = '';
    flash(`已儲存 ${r.name} 的評分`);
  } catch (err) {
    btn.disabled = false;
    msg.className = 'save-msg err';
    msg.textContent = err.message;
  }
}

function flash(text) {
  $('progressLine').insertAdjacentHTML('beforeend', `<span class="flash" style="color:var(--accent);margin-left:8px;">✓ ${escapeHtml(text)}</span>`);
  setTimeout(() => document.querySelector('.flash')?.remove(), 3000);
}

async function showSelfEval(id, btn) {
  const r = data.ratees.find((x) => x.staff_id === id);
  const slot = btn.nextElementSibling;
  if (slot.innerHTML) { slot.innerHTML = ''; return; }
  if (!r.self_eval.submission_id) {
    slot.innerHTML = `<div class="self-eval">${escapeHtml(r.name)} 這個月還沒有填自評表。</div>`;
    return;
  }
  slot.innerHTML = '<div class="self-eval">載入中…</div>';
  try {
    const detail = selfEvalCache[id] || await api(`/api/self-eval/submission-detail?submission_id=${encodeURIComponent(r.self_eval.submission_id)}`);
    selfEvalCache[id] = detail;
    slot.innerHTML = selfEvalHtml(detail);
  } catch (err) {
    slot.innerHTML = `<div class="self-eval">${escapeHtml(err.message)}</div>`;
  }
}

function selfEvalHtml(detail) {
  const s = detail.submission;
  const label = (v) => (v === 'yes' ? '是' : v === 'no' ? '否' : '—');
  const STATUS = { draft: '還沒送出（草稿）', submitted: '已送出，還沒完成面談', reviewed: '已完成面談' };
  const answers = detail.answers.map((a) => `
    <div class="qa">
      <div class="q">${escapeHtml(a.template?.question_zh || '')}</div>
      <div class="a ${a.staff_answer === 'no' ? 'no' : ''}">自檢：${label(a.staff_answer)}${a.staff_note ? '　' + escapeHtml(a.staff_note) : ''}</div>
      ${a.manager_answer || a.manager_note ? `<div class="a ${a.manager_answer === 'no' ? 'no' : ''}">主管確認：${label(a.manager_answer)}${a.manager_note ? '　' + escapeHtml(a.manager_note) : ''}</div>` : ''}
    </div>`).join('');
  const reviewer = s.reviewed_by_name ? `（${escapeHtml(s.reviewed_by_name)}）` : '';
  return `<div class="self-eval">
    <h4>${monthText(s.eval_month)}自評表・${STATUS[s.status] || ''}${s.status === 'reviewed' ? reviewer : ''}</h4>
    ${answers || '<p>沒有作答紀錄</p>'}
    <div class="notes"><b>面談及改善追蹤紀錄</b>${s.interview_date ? `（${escapeHtml(s.interview_date)}）` : ''}<br>${escapeHtml(s.manager_interview_notes || '（還沒有紀錄）')}</div>
  </div>`;
}

// ---------- 回饋與期望（現場正職） ----------

function renderFeedback() {
  if (!data.can_feedback) { $('feedbackArea').innerHTML = ''; return; }
  const fb = data.feedback || { feedback: '' };
  const editable = data.can_rate_now;
  $('feedbackArea').innerHTML = `
    <h2 class="sec-title">我有話要說<small>選填</small></h2>
    <div class="feedback-box">
      <p class="hint">歡迎對公司或主管給予任何意見和建議，具體寫下你的看法。內容會提供給總公司和主管做為改進參考，詳盡的建議會斟酌加點。</p>
      <label class="comment-label" for="fbText" style="margin-top:0;">回饋與期望</label>
      <textarea id="fbText" ${editable ? '' : 'disabled'}>${escapeHtml(fb.feedback)}</textarea>
      ${editable ? '<div class="action-row"><button type="button" class="btn" id="fbSave">儲存</button></div>' : ''}
      <p class="save-msg" id="fbMsg">${fb.updated_at ? '上次儲存：' + new Date(fb.updated_at).toLocaleString('zh-TW', { hour12: false }) : ''}</p>
    </div>`;
  if (editable) $('fbSave').addEventListener('click', saveFeedback);
}

async function saveFeedback() {
  $('fbMsg').className = 'save-msg';
  $('fbMsg').textContent = '儲存中…';
  try {
    await api('/api/appraisal/feedback', 'POST', { feedback: $('fbText').value });
    $('fbMsg').className = 'save-msg ok';
    $('fbMsg').textContent = '已儲存';
  } catch (err) {
    $('fbMsg').className = 'save-msg err';
    $('fbMsg').textContent = err.message;
  }
}
