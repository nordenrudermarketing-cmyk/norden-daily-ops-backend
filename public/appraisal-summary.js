// 評核彙整（人事行政、總辦公室）——後端見 gas/AppraisalSummary.gs
// 1. 人事行政確認還有哪些資料沒完成、填客戶評價  2. 送審（依當下資料，沒填完也能送）
// 3. 總辦公室看每個人的分數、誰給幾分、獎金試算，任何一位按「審核完成」就定案；定案後要改請總辦公室按「修改」

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const $ = (id) => document.getElementById(id);

let data = null;
const opened = new Set(); // 展開中的同仁，重新載入後維持展開

if (!staff) {
  window.location.href = 'index.html';
} else if (!['hq_admin', 'office'].includes(window.accountLevelOf(staff))) {
  alert('評核彙整只有人事行政、總辦公室帳號可以使用');
  window.location.href = 'index.html';
} else {
  $('staffLine').textContent = staff.name;
  $('monthSelect').addEventListener('change', () => load($('monthSelect').value));
  // 從「我的待辦」點進來時，會先記下要看哪個月
  let month = '';
  try {
    month = localStorage.getItem('appraisal_summary_month') || '';
    localStorage.removeItem('appraisal_summary_month');
  } catch (e) { /* 讀不到就看預設月份 */ }
  load(month);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
const monthLabel = (m) => `${m.slice(0, 4)} 年 ${Number(m.slice(5, 7))} 月`;
const when = (iso) => (iso ? new Date(iso).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;

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

function setStatus(text, isError = true) {
  $('statusLine').textContent = text;
  $('statusLine').style.color = isError ? '' : 'var(--accent)';
}

async function load(month) {
  setStatus('');
  $('resultCard').innerHTML = '<p class="empty-state">載入中…</p>';
  try {
    data = await api(`/api/appraisal/summary${month ? `?eval_month=${encodeURIComponent(month)}` : ''}`);
  } catch (err) {
    $('resultCard').innerHTML = '';
    setStatus(err.message);
    return;
  }
  render();
}

function render() {
  $('monthSelect').innerHTML = data.months.map((m) =>
    `<option value="${m.slice(0, 7)}" ${m === data.eval_month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('');
  $('statusPill').innerHTML = `<span class="pill ${data.status}">${escapeHtml(data.status_label)}</span>`;
  renderStatus();
  renderChecks();
  renderInputs();
  renderResults();
}

// ---------- 狀態與按鈕 ----------

function renderStatus() {
  const w = data.window;
  const lines = [];
  lines.push(`評分期間 ${md(w.open_date)}～${md(w.close_date)}，${md(w.publish_due_date)} 前送審定案。`);
  if (data.status === 'draft') lines.push('目前是<b>彙整中</b>：下面的分數和獎金是依目前資料<b>即時試算</b>。資料沒填完也可以送審。');
  if (data.status === 'submitted') lines.push(`<b>${escapeHtml(data.submitted_by_name)}</b> 在 ${when(data.submitted_at)} 送審，等總辦公室審核。下面是送審當下的資料。`);
  if (data.status === 'approved') {
    lines.push(`已由 <b>${escapeHtml(data.approved_by_name)}</b> 在 ${when(data.approved_at)} 審核完成，這個月定案。`);
    lines.push('定案後評分和客戶評價都不能再改；需要修改請總辦公室按「修改」。');
  }

  const buttons = [];
  if (data.can_submit) buttons.push(`<button class="btn" id="submitBtn">${data.status === 'submitted' ? '依目前資料重新送審' : '送審'}</button>`);
  if (data.can_approve) buttons.push('<button class="btn" id="approveBtn">審核完成（定案）</button>');
  if (data.can_reopen) buttons.push('<button class="btn warn" id="reopenBtn">修改</button>');

  const history = data.history.length ? `
    <details class="history"><summary>紀錄（${data.history.length}）</summary><ul>
      ${data.history.slice().reverse().map((h) => `<li>${when(h.at)}　${escapeHtml(h.by_name)}　${escapeHtml(h.label)}</li>`).join('')}
    </ul></details>` : '';

  $('statusCard').innerHTML = `
    <div class="card">
      <p class="status-text">${lines.join('<br>')}</p>
      ${data.changed_since_submit ? '<div class="notice">送審之後評分或客戶評價又有變動，下面顯示的還是送審當時的資料。要用新的資料請按「依目前資料重新送審」。</div>' : ''}
      ${buttons.length ? `<div class="actions">${buttons.join('')}</div>` : ''}
      ${history}
    </div>`;

  const month = data.eval_month.slice(0, 7);
  const mText = `${Number(month.slice(5, 7))} 月`;
  if ($('submitBtn')) $('submitBtn').addEventListener('click', () => {
    const pending = (data.checks?.raters_pending.length || 0) + (data.checks?.missing_scores.length || 0);
    const warn = pending ? '\n\n還有資料沒完成（見「還沒完成的資料」），沒評到的項目不會有獎金。' : '';
    if (!confirm(`確定要把 ${mText}評核送審嗎？會依目前的資料計算，送給總辦公室審核。${warn}`)) return;
    act('/api/appraisal/summary/submit', '已送審，總辦公室會看到');
  });
  if ($('approveBtn')) $('approveBtn').addEventListener('click', () => {
    const warn = data.changed_since_submit ? '\n\n注意：送審之後資料又有變動，定案的是送審當時的資料。' : '';
    if (!confirm(`確定 ${mText}評核審核完成嗎？定案後就不能再修改（除非按「修改」）。${warn}`)) return;
    act('/api/appraisal/summary/approve', '已定案');
  });
  if ($('reopenBtn')) $('reopenBtn').addEventListener('click', () => {
    if (!confirm(`確定要修改已定案的 ${mText}評核嗎？會回到「彙整中」，改完要重新送審、審核。`)) return;
    act('/api/appraisal/summary/reopen', '已改回可修改');
  });
}

async function act(path, okText) {
  document.querySelectorAll('#statusCard .btn').forEach((b) => { b.disabled = true; });
  setStatus('處理中…', false);
  try {
    data = await api(path, 'POST', { eval_month: data.eval_month });
  } catch (err) {
    setStatus(err.message);
    document.querySelectorAll('#statusCard .btn').forEach((b) => { b.disabled = false; });
    return;
  }
  render();
  setStatus(okText, false);
}

// ---------- 還沒完成的資料 ----------

function renderChecks() {
  const c = data.checks;
  if (!c) { $('checkCard').innerHTML = ''; return; }
  const raterCount = c.raters_pending.length;
  const scoreCount = c.missing_scores.length;
  const sum = (raterCount || scoreCount)
    ? `<span class="bad">還有 ${raterCount} 位評分者沒評完、${scoreCount} 位同仁有項目還沒有分數</span>`
    : '<span class="ok">✓ 評分和輸入的資料都完成了</span>';
  const block = (title, rows) => rows.length
    ? `<details class="check"><summary>${title}（${rows.length}）</summary><ul>${rows.join('')}</ul></details>` : '';
  $('checkCard').innerHTML = `
    <div class="card">
      <h2>還沒完成的資料<small>依目前的帳號與管轄設定</small></h2>
      <p class="check-sum">${sum}</p>
      ${block('還沒評完的評分者', c.raters_pending.map((r) =>
        `<li><b>${escapeHtml(r.name)}</b>（${escapeHtml(r.branch_name)}・${r.done}/${r.total}）還沒評：${escapeHtml(r.missing_names.join('、'))}</li>`))}
      ${block('還沒有分數的項目', c.missing_scores.map((p) =>
        `<li><b>${escapeHtml(p.name)}</b>（${escapeHtml(p.branch_name)}）：${escapeHtml(p.items.join('、'))}</li>`))}
      ${block('只有總辦公室能評的同仁（沒有管轄的主管）', c.no_required_rater.map((n) => `<li>${escapeHtml(n)}</li>`))}
      ${block('職務沒有對應評核類別、不會被評核的同仁', c.no_items.map((n) => `<li>${escapeHtml(n)}</li>`))}
    </div>`;
}

// ---------- 人事行政輸入的項目（客戶評價） ----------

function renderInputs() {
  if (!data.inputs.length) { $('inputCard').innerHTML = ''; return; }
  const editable = data.can_edit_inputs;
  const rows = [];
  data.inputs.forEach((p) => p.items.forEach((i) => {
    rows.push(`
      <div class="input-row" data-staff="${p.staff_id}" data-item="${i.item_id}">
        <span class="who">${escapeHtml(p.name)} <small>${escapeHtml(p.branch_name)}・${escapeHtml(i.name)}</small></span>
        <input class="score" type="number" min="0" max="100" step="1" placeholder="分數" value="${i.score ?? ''}" ${editable ? '' : 'disabled'}>
        <input class="note" type="text" placeholder="備註（選填，例如各平台分數）" value="${escapeHtml(i.note)}" ${editable ? '' : 'disabled'}>
        ${editable ? '<button class="btn ghost" data-save style="padding:6px 12px;font-size:13px;">儲存</button>' : ''}
        <span class="msg"></span>
      </div>`);
  }));
  $('inputCard').innerHTML = `
    <div class="card">
      <h2>客戶評價等輸入項目<small>人事行政每月輸入，0～100 分</small></h2>
      <p class="hint">例如客戶評價：到各訂房平台查詢，每個平台評分超過 9 分（或 4.5 分）得 25 分。空白＝還沒填（這一項不會有獎金）。</p>
      ${rows.join('')}
    </div>`;
  document.querySelectorAll('#inputCard [data-save]').forEach((btn) => btn.addEventListener('click', () => saveInput(btn.closest('.input-row'))));
}

async function saveInput(row) {
  const msg = row.querySelector('.msg');
  msg.className = 'msg';
  msg.textContent = '儲存中…';
  try {
    await api('/api/appraisal/inputs', 'PUT', {
      eval_month: data.eval_month,
      staff_id: row.dataset.staff,
      item_id: row.dataset.item,
      score: row.querySelector('.score').value,
      note: row.querySelector('.note').value,
    });
  } catch (err) {
    msg.className = 'msg err';
    msg.textContent = err.message;
    return;
  }
  msg.textContent = '已儲存';
  // 重新計算（彙整中時下面的試算會跟著更新）
  const keep = data.eval_month.slice(0, 7);
  data = await api(`/api/appraisal/summary?eval_month=${keep}`).catch(() => data);
  renderChecks();
  renderResults();
  renderStatus();
}

// ---------- 每位同仁的分數與獎金 ----------

function renderResults() {
  const people = data.people;
  if (!people.length) {
    $('resultCard').innerHTML = '<div class="card"><p class="empty-state">這個月沒有要評核的同仁。</p></div>';
    return;
  }
  const source = data.is_live ? '即時試算（還沒送審）' : `送審時的資料（${when(data.submitted_at)}）`;
  const byBranch = {};
  people.forEach((p) => { (byBranch[p.branch_name] = byBranch[p.branch_name] || []).push(p); });
  const missingPeople = people.filter((p) => p.missing_count > 0).length;

  $('resultCard').innerHTML = `
    <div class="card">
      <h2>分數與獎金<small>${source}</small></h2>
      <div class="totals">
        <div><b>${people.length}</b><span>評核人數</span></div>
        <div><b>${money(data.total_bonus)}</b><span>獎金合計</span></div>
        <div><b>${missingPeople}</b><span>有項目沒分數</span></div>
      </div>
      <p class="hint">點同仁可以展開：每一項誰給了幾分、平均、基數與獎金怎麼算、評核留言。最後分數未滿 ${data.pass_score} 分的項目沒有獎金。</p>
      ${Object.keys(byBranch).map((b) => `
        <p class="branch">${escapeHtml(b)}　<span style="font-weight:400;">${money(byBranch[b].reduce((s, p) => s + p.total_bonus, 0))}</span></p>
        ${byBranch[b].map(personHtml).join('')}`).join('')}
    </div>`;
  document.querySelectorAll('.person-head').forEach((head) => head.addEventListener('click', () => {
    const box = head.closest('.person');
    box.classList.toggle('open');
    if (box.classList.contains('open')) opened.add(box.dataset.id);
    else opened.delete(box.dataset.id);
  }));
}

function personHtml(p) {
  const chips = p.items.map((i) => {
    if (i.final === null) return `<span class="chip none">${escapeHtml(i.name)} 沒分數</span>`;
    return `<span class="chip ${i.final < data.pass_score ? 'low' : ''}">${escapeHtml(i.name)} ${i.final}</span>`;
  }).join('');
  const rows = p.items.map((i) => {
    const raters = i.source === 'input'
      ? (i.final === null ? '還沒輸入' : `人事行政輸入${i.note ? '：' + escapeHtml(i.note) : ''}`)
      : (i.ratings.length ? i.ratings.map((r) => `${escapeHtml(r.rater_name)} ${r.grade}（${r.points}）`).join('、') : '還沒有人評');
    const formula = i.final === null ? '—'
      : i.final < data.pass_score ? `未滿 ${data.pass_score} 分`
        : `${i.final} × ${i.base}`;
    return `
      <tr>
        <td>${escapeHtml(i.name)}${i.takes_reward ? '<br><span class="formula">接獎懲</span>' : ''}</td>
        <td class="raters">${raters}</td>
        <td>${i.average ?? '—'}</td>
        <td>${i.reward ? (i.reward > 0 ? '+' : '') + i.reward : '—'}</td>
        <td>${i.final ?? '—'}</td>
        <td>${money(i.base)}</td>
        <td><b>${money(i.bonus)}</b><br><span class="formula">${formula}</span></td>
      </tr>`;
  }).join('');
  const comments = p.comments.length
    ? `<div class="comments">${p.comments.map((c) => `<p><b>${escapeHtml(c.rater_name)}：</b>${escapeHtml(c.comment)}</p>`).join('')}</div>`
    : '<div class="comments" style="color:var(--ink-soft);">沒有評核留言</div>';
  return `
    <div class="person ${opened.has(p.staff_id) ? 'open' : ''}" data-id="${p.staff_id}">
      <div class="person-head">
        <span class="name">${escapeHtml(p.name)}</span>
        ${p.role_name ? `<span class="tag">${escapeHtml(p.role_name)}</span>` : ''}
        ${p.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        <span class="chips">${chips}</span>
        <span class="money">${money(p.total_bonus)}</span>
      </div>
      <div class="person-body">
        <table class="calc">
          <thead><tr><th>項目</th><th style="text-align:left;">誰給了幾分</th><th>平均</th><th>獎懲</th><th>最後分數</th><th>基數</th><th>獎金</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${comments}
      </div>
    </div>`;
}
