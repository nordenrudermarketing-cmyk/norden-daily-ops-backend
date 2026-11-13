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

// ---------- 我的待辦（所有人的總覽頁共用） ----------

// GET /api/home/todos
// todos：還沒做完的事（due＝期限，overdue＝已逾期）；done：這個月已經做完的事。url 是點下去要去的頁面
// 例行任務不在這裡（主管首頁另外顯示）
function apiHomeTodos_(req) {
  const actor = req.actor;
  const today = taipeiDate_();
  const features = getFeatureState_();
  const todos = [];
  const done = [];
  const monthText = function (evalMonth) { return Number(evalMonth.slice(5, 7)) + ' 月'; };

  // 自評：自己這個月的表
  if (fillsSelfEval_(actor.level)) {
    const evalMonth = currentEvalMonth_();
    const schedule = scheduleFor_(evalMonth);
    const own = Db.first('self_eval_submissions', { staff_id: actor.id, eval_month: evalMonth });
    const status = own ? own.status : 'not_started';
    if (status === 'not_started' || status === 'draft') {
      todos.push({
        title: '填寫 ' + monthText(evalMonth) + '自評表' + (status === 'draft' ? '（已存草稿，還沒送出）' : ''),
        due: schedule.staff_due_date, overdue: today > schedule.staff_due_date, url: 'self-eval.html',
      });
    } else {
      done.push({ title: monthText(evalMonth) + '自評表' + (status === 'reviewed' ? '：已完成面談' : '：已送出，等主管面談'), url: 'self-eval.html' });
    }
  }

  // 面談：管轄的同仁已送出、還沒面談的自評
  if (canSuperviseLevel_(actor.level) && superviseesOf_(actor.id).length) {
    const evalMonth = currentEvalMonth_();
    const schedule = scheduleFor_(evalMonth);
    const people = apiSelfEvalMyReviewees_({ actor: actor, query: { eval_month: evalMonth } });
    const waiting = people.filter(function (p) { return p.submission && p.submission.status === 'submitted'; }).length;
    if (waiting) {
      todos.push({
        title: '還有 ' + waiting + ' 位同仁的' + monthText(evalMonth) + '自評等你面談',
        due: schedule.interview_due_date, overdue: today > schedule.interview_due_date, url: 'self-eval-review.html',
      });
    }
  }

  if (features.appraisal) {
    // 評核評分：這個月要評的人
    const mine = apiAppraisalMine_({ actor: actor, query: {}, body: {} });
    const win = mine.window;
    const left = mine.required_total - mine.required_done;
    if (mine.ratees.length && win.state === 'upcoming' && !win.testing_override) {
      todos.push({
        title: monthText(win.eval_month) + '評核 ' + win.open_date.slice(5).replace('-', '/') + ' 開放評分（要評 ' + mine.ratees.length + ' 位）',
        due: win.close_date, overdue: false, upcoming: true, url: 'appraisal.html',
      });
    } else if (mine.can_rate_now && left > 0) {
      todos.push({
        title: monthText(win.eval_month) + '評核：還有 ' + left + ' 位要評分',
        due: win.close_date, overdue: false, url: 'appraisal.html',
      });
    } else if (mine.can_rate_now && mine.required_total > 0) {
      done.push({ title: monthText(win.eval_month) + '評核：' + mine.required_total + ' 位都評完了', url: 'appraisal.html' });
    }

    // 評核彙整：人事行政送審、總辦公室審核
    if (canManageAppraisal_(actor.level)) {
      summaryMonthOptions_().slice(0, 3).forEach(function (evalMonth) {
        const status = appraisalMonthStatus_(evalMonth);
        const w = appraisalWindow_(evalMonth);
        // month：網頁點下去時記住要看哪個月（內框網頁拿不到網址參數）
        const link = { url: 'appraisal-summary.html', month: evalMonth.slice(0, 7) };
        if (status === 'submitted' && canApproveAppraisal_(actor.level)) {
          todos.push(Object.assign({ title: monthText(evalMonth) + '評核已送審，等你審核', due: w.publish_due_date, overdue: today > w.publish_due_date }, link));
        } else if (status === 'draft' && today > w.close_date) {
          todos.push(Object.assign({ title: monthText(evalMonth) + '評核還沒送審', due: w.publish_due_date, overdue: today > w.publish_due_date }, link));
        } else if (status === 'approved' && today <= addMonths_(evalMonth.slice(0, 7), 2) + '-01') {
          done.push(Object.assign({ title: monthText(evalMonth) + '評核已定案' }, link));
        }
      });
    }
  }

  todos.sort(function (a, b) { return (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || String(a.due || '9999').localeCompare(String(b.due || '9999')); });
  return { today: today, name: actor.name, todos: todos, done: done };
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
