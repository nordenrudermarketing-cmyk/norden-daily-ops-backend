// 主管首頁：還沒做完的例行任務、自評進度、管轄清單，點卡片就到對應的頁面
// 資料來自 /api/home/manager（gas/Home.gs），一次抓完

// 部署時 API_BASE_URL 是空字串（前後端同網域），不能拿來當 if 判斷
const API = window.APP_CONFIG?.API_BASE_URL ?? '';
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const level = staff ? window.accountLevelOf(staff) : null;

const $ = (id) => document.getElementById(id);
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
// 首頁最多列幾項例行任務，其他的到例行任務頁看
const ROUTINE_PREVIEW = 6;

if (!staff) {
  window.location.href = 'index.html';
} else if (level === 'office') {
  window.location.href = 'hq-dashboard.html';
} else if (level !== 'manager') {
  window.location.href = 'self-eval.html';
} else {
  load();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function md(ymd) {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
}

async function load() {
  $('hello').textContent = `${staff.name}，你好`;
  let data;
  try {
    const res = await fetch(`${API}/api/home/manager`);
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '載入失敗');
  } catch (err) {
    $('cards').innerHTML = '';
    $('statusLine').textContent = err.message;
    return;
  }
  const d = new Date(`${data.today}T00:00:00`);
  $('todayLine').textContent = `今天 ${md(data.today)}（${WEEKDAYS[d.getDay()]}）`;

  $('cards').innerHTML = [
    data.routine ? routineCard(data.routine) : '',
    selfEvalCard(data.self_eval),
    supervisionCard(data.supervision),
  ].join('');

  $('cards').querySelectorAll('[data-href]').forEach((card) => {
    card.addEventListener('click', () => { window.location.href = card.dataset.href; });
  });
}

function routineCard(r) {
  if (!r.has_branches) {
    return `<div class="home-card" data-href="routine-tasks.html">
      <h2>例行任務<span class="go">查看 →</span></h2>
      <p class="line">你還沒有管轄的部門，請總公司在「帳號管理」→「管轄設定」勾選你負責的部門。</p>
    </div>`;
  }
  const num = (label, n, warn) => `<div class="num ${warn && n ? 'warn' : ''}"><b>${n}</b><span>${label}</span></div>`;
  const multi = r.branch_count > 1;
  const rows = r.items.slice(0, ROUTINE_PREVIEW).map((i) => {
    const late = i.status !== 'open';
    const progress = i.times > 1 ? `・${i.done_count}/${i.times}` : '';
    return `<li>
      <span>${escapeHtml(i.title)}${multi ? `<br><span class="sub">${escapeHtml(i.branch_name)}</span>` : ''}</span>
      <span class="${late ? 'late' : 'right'}">${late ? `逾期・${escapeHtml(i.period_label)}` : escapeHtml(i.due_label)}${progress}</span>
    </li>`;
  }).join('');
  const rest = r.items.length - ROUTINE_PREVIEW;
  return `<div class="home-card ${r.behind ? 'warn' : ''}" data-href="routine-tasks.html">
    <h2>還沒做完的例行任務<span class="go">去回報 →</span></h2>
    <div class="nums">
      ${num('要補回報', r.behind, true)}${num('本週', r.week)}${num('本月', r.month)}${num('今年', r.year)}
    </div>
    ${rows ? `<ul class="rows">${rows}</ul>` : '<p class="line">目前的例行任務都完成了 🎉</p>'}
    ${rest > 0 ? `<p class="more">還有 ${rest} 項…</p>` : ''}
  </div>`;
}

function selfEvalCard(s) {
  const month = `${s.eval_month.slice(0, 4)} 年 ${Number(s.eval_month.slice(5, 7))} 月`;
  const OWN = {
    not_started: ['還沒開始填', 'warn'],
    draft: ['已存草稿，還沒送出', 'warn'],
    submitted: ['已送出，等主管面談', 'ok'],
    reviewed: ['已完成面談', 'ok'],
  };
  const [ownText, ownCls] = OWN[s.own_status] || OWN.not_started;
  const own = `<div class="home-card" data-href="self-eval.html">
    <h2>我的自評（${month}）<span class="go">去填寫 →</span></h2>
    <p class="line">${md(s.staff_due_date)} 前送出<span class="tag ${ownCls}">${ownText}</span></p>
  </div>`;
  if (s.total === 0) return own;
  return `${own}<div class="home-card ${s.to_interview ? 'warn' : ''}" data-href="self-eval-review.html">
    <h2>同仁自評與面談（${month}）<span class="go">去面談 →</span></h2>
    <div class="nums">
      <div class="num"><b>${s.not_submitted}</b><span>還沒送出</span></div>
      <div class="num ${s.to_interview ? 'warn' : ''}"><b>${s.to_interview}</b><span>待面談</span></div>
      <div class="num"><b>${s.reviewed}</b><span>已面談</span></div>
    </div>
    <p class="line" style="margin:0;font-size:12px;color:var(--ink-soft);">管轄 ${s.total} 位同仁・面談期限 ${md(s.interview_due_date)}</p>
  </div>`;
}

function supervisionCard(sup) {
  const groups = new Map();
  sup.people.forEach((p) => {
    if (!groups.has(p.branch_name)) groups.set(p.branch_name, []);
    groups.get(p.branch_name).push(p);
  });
  const people = [...groups.entries()].map(([branch, list]) => `
    <p class="group">${escapeHtml(branch)}（${list.length}）</p>
    <p class="names">${list.map((p) => `${escapeHtml(p.name)}<small>・${escapeHtml(p.role_name)}</small>`).join('、')}</p>`).join('');
  return `<div class="home-card" data-href="manage-passwords.html">
    <h2>我的管轄<span class="go">帳號管理 →</span></h2>
    <p class="line">管轄部門：${sup.branch_names.length ? escapeHtml(sup.branch_names.join('、')) : '還沒有設定'}</p>
    ${people || '<p class="line">還沒有管轄的同仁（由總公司在帳號管理設定）。</p>'}
  </div>`;
}
