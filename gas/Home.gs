// ============================================================
// 主管首頁（manager-home.html）：登入後一頁看完「還沒做完的例行任務、自評進度、管轄的人和部門」
//
// 一次把資料組好回傳（Apps Script 每呼叫一次 API 大約要 1 秒，分開抓會慢）。
// 這裡只做彙整，規則都沿用原本的函式：例行任務 Routine.gs、自評 SelfEval.gs、管轄 Supervision.gs。
// 例行任務被功能開關關掉時不回傳那一段，網頁就不顯示。
// ============================================================

// GET /api/home/manager
function apiHomeManager_(req) {
  const actor = req.actor;
  if (actor.level !== 'manager') throw httpError_(403, '主管首頁只開放給主管');
  return {
    today: taipeiDate_(),
    routine: getFeatureState_().routine_tasks ? homeRoutine_(req) : null,
    self_eval: homeSelfEval_(req),
    supervision: homeSupervision_(actor),
  };
}

// 例行任務：還沒回報的（逾期的排前面），加上各區數量
function homeRoutine_(req) {
  const mine = apiRoutineMine_(req);
  const order = { overdue: 0, backlog: 0, open: 1 };
  const open = mine.instances
    .filter(function (i) { return i.status in order; })
    .sort(function (a, b) {
      return (order[a.status] - order[b.status]) || String(a.due || '9999').localeCompare(String(b.due || '9999'));
    });
  const count = function (fn) { return open.filter(fn).length; };
  return {
    has_branches: mine.branches.length > 0,
    branch_count: mine.branches.length,
    behind: count(function (i) { return i.status !== 'open'; }),
    week: count(function (i) { return i.status === 'open' && i.period === 'week'; }),
    month: count(function (i) { return i.status === 'open' && i.period === 'month'; }),
    year: count(function (i) { return i.status === 'open' && i.period === 'year'; }),
    items: open.map(function (i) {
      return {
        title: i.title, branch_name: i.branch_name, status: i.status, due_label: i.due_label,
        period_label: i.period_label, done_count: i.done_count, times: i.times,
      };
    }),
  };
}

// 自評：自己這一期的狀態，以及管轄同仁的填寫、面談進度
function homeSelfEval_(req) {
  const evalMonth = currentEvalMonth_();
  const schedule = scheduleFor_(evalMonth);
  const own = Db.first('self_eval_submissions', { staff_id: req.actor.id, eval_month: evalMonth });
  const people = apiSelfEvalMyReviewees_({ actor: req.actor, query: { eval_month: evalMonth } });
  const statusOf = function (sub) { return sub ? sub.status : 'not_started'; };
  return {
    eval_month: evalMonth,
    staff_due_date: schedule.staff_due_date,
    interview_due_date: schedule.interview_due_date,
    own_status: statusOf(own),
    total: people.length,
    not_submitted: people.filter(function (p) { return ['not_started', 'draft'].indexOf(statusOf(p.submission)) >= 0; }).length,
    to_interview: people.filter(function (p) { return statusOf(p.submission) === 'submitted'; }).length,
    reviewed: people.filter(function (p) { return statusOf(p.submission) === 'reviewed'; }).length,
  };
}

// 管轄：管轄的部門、管轄的同仁（依部門分組）
function homeSupervision_(actor) {
  const people = superviseesOf_(actor.id)
    .map(function (id) { return Db.first('staff', { id: id }); })
    .filter(function (s) { return s && s.is_active === true; })
    .map(function (s) {
      const role = roleById_(s.role_id);
      const branch = branchById_(s.branch_id);
      return { name: s.name, role_name: role ? role.name : '', branch_name: branch ? branch.name : '（沒有部門）' };
    })
    .sort(function (a, b) { return a.branch_name.localeCompare(b.branch_name, 'zh-Hant') || byName_(a, b); });
  return {
    branch_names: branchNames_(supervisedBranchIdsOf_(actor.id)),
    people: people,
  };
}
