// 評分進度（總公司行政、總辦公室）——後端見 gas/Appraisal.gs 的 apiAppraisalProgress_
// 每位評分者完成幾人、還沒評誰；另外提醒「沒有人一定要評」「還沒有任何評分」「職務沒有評核項目」的同仁，避免漏評

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const $ = (id) => document.getElementById(id);
const level = staff ? window.accountLevelOf(staff) : null;

if (!staff) {
  window.location.href = 'index.html';
} else if (level !== 'office' && level !== 'hq_admin') {
  window.location.href = 'appraisal.html';
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

async function load() {
  let data;
  try {
    const res = await fetch(`${API}/api/appraisal/progress`);
    data = await res.json();
    if (!res.ok) throw new Error(data.error || '讀取失敗');
  } catch (err) {
    $('list').innerHTML = '';
    $('statusLine').textContent = err.message;
    return;
  }
  render(data);
}

function render(data) {
  const w = data.window;
  const STATE = { upcoming: '還沒開放', open: '開放中', closed: '已截止' };
  const required = data.raters.reduce((n, r) => n + r.required_total, 0);
  const done = data.raters.reduce((n, r) => n + r.required_done, 0);
  $('banner').innerHTML = `<div class="banner">${monthText(w.eval_month)}評核・${STATE[w.state]}（${shortDate(w.open_date)}～${shortDate(w.close_date)}）<br>
    要評核 ${data.appraisee_total} 人；必填的評分共 ${required} 份，已完成 ${done} 份。</div>`;

  const warn = (title, names, hint) => names.length
    ? `<div class="warn-box"><b>${title}（${names.length} 人）</b>：${escapeHtml(names.join('、'))}<br>${hint}</div>` : '';
  $('warnings').innerHTML =
    warn('只有總辦公室能評的同仁', data.no_required_rater, '沒有管轄的主管、也不是兼職或實習生，只會出現在總辦公室的評分名單。如果應該由主管評，請到帳號管理設定管轄。') +
    warn('還沒有任何評分的同仁', w.state === 'upcoming' ? [] : data.not_rated_yet, '截止前請確認有人評分，否則這個月沒有分數。') +
    warn('職務沒有評核項目的同仁', data.no_items, '這些人不會被評核。需要評核的話，請到「評核項目設定」幫他的職務指定評核類別。');

  if (!data.raters.length) {
    $('list').innerHTML = '<p class="empty-state">目前沒有人需要評分。請先到「評核項目設定」設定評核類別與職務。</p>';
    return;
  }
  const byBranch = {};
  data.raters.forEach((r) => { (byBranch[r.branch_name] = byBranch[r.branch_name] || []).push(r); });
  $('list').innerHTML = Object.keys(byBranch).map((branch) => `
    <h2 class="sec-title">${escapeHtml(branch)}</h2>
    ${byBranch[branch].map(row).join('')}`).join('');
}

function row(r) {
  let status;
  if (!r.required_total) status = `<span class="st opt">選填・已評 ${r.optional_done} 人</span>`;
  else if (r.required_done >= r.required_total) status = '<span class="st done">完成</span>';
  else status = `<span class="st todo">${r.required_done}/${r.required_total}</span>`;
  const missing = r.missing_names.length ? `還沒評：${escapeHtml(r.missing_names.join('、'))}` : '';
  const optional = r.required_total && r.optional_done ? `另外選填評了 ${r.optional_done} 人` : '';
  return `
    <div class="row">
      <div class="who">
        <div class="name">${escapeHtml(r.name)}</div>
        <div class="meta">${escapeHtml(r.level_label)}${missing ? '<br>' + missing : ''}${optional ? '<br>' + optional : ''}</div>
      </div>
      ${status}
    </div>`;
}
