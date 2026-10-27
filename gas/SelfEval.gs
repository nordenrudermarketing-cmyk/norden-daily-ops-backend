// ============================================================
// 每月自評表——規則與 Railway 版 routes/selfEval.js 相同
//
// 時程（全部以台灣時間計算）：
//   每月 1 號   系統發布「上個月」的自評表（例如 9/1 發布 8 月的表）
//   每月 10 號前 同仁完成填寫並送出
//   每月 20 號前 主管完成面談（在審閱頁按「完成面談」）
// 逾期只會標示提醒，不會擋住填寫或面談。
//
// 跟 Railway 版的差別：加上權限檢查（同仁只能填自己的表、主管只能看自己館別、題目管理限總公司）。
// ============================================================

const SELF_EVAL_SCHEDULE = { releaseDay: 1, staffDueDay: 10, interviewDueDay: 20 };

// 職務類別 → 自評題目類別（除了共同題目外，額外要加的專屬題目類別）
const ROLE_CATEGORY_MAP = { housekeeping: 'housekeeping', frontdesk: 'frontdesk', management: 'management', headquarters: 'management' };

function pad2_(n) {
  return String(n).padStart(2, '0');
}

// '2026-08' 加減 n 個月
function addMonths_(yearMonth, n) {
  const parts = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1 + n, 1)).toISOString().slice(0, 7);
}

// 今天應該填的是哪個月份的表（上個月的 1 號）
function currentEvalMonth_() {
  return addMonths_(taipeiDate_().slice(0, 7), -1) + '-01';
}

// 接受 '2026-08' 或 '2026-08-01'，格式不對就回到目前這一期
function normalizeEvalMonth_(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(value)) return value.slice(0, 7) + '-01';
  return currentEvalMonth_();
}

function scheduleFor_(evalMonth) {
  const next = addMonths_(evalMonth.slice(0, 7), 1);
  return {
    eval_month: evalMonth,
    release_date: next + '-' + pad2_(SELF_EVAL_SCHEDULE.releaseDay),
    staff_due_date: next + '-' + pad2_(SELF_EVAL_SCHEDULE.staffDueDay),
    interview_due_date: next + '-' + pad2_(SELF_EVAL_SCHEDULE.interviewDueDay),
  };
}

function bySortOrder_(a, b) {
  return (a.sort_order || 0) - (b.sort_order || 0);
}

// 原本的 .order('category').order('sort_order')
function byCategoryThenSort_(a, b) {
  const c = String(a.category || '').localeCompare(String(b.category || ''));
  return c !== 0 ? c : bySortOrder_(a, b);
}

// 同仁本人、該館主管、總公司可以看這位同仁的自評表
function requireStaffAccess_(actor, staffId) {
  if (staffId === actor.id || actor.level === 'hq') return;
  const target = Db.first('staff', { id: staffId });
  if (actor.level === 'manager' && target && target.branch_id === actor.branch_id) return;
  throw httpError_(403, '你沒有權限查看這份自評表');
}

function loadSubmission_(submissionId) {
  const submission = Db.first('self_eval_submissions', { id: submissionId });
  if (!submission) throw httpError_(400, '找不到這份自評表');
  return submission;
}

// ---------- 時程 ----------

// GET /api/self-eval/schedule?eval_month=2026-08-01（選填）
function apiSelfEvalSchedule_(req) {
  const evalMonth = normalizeEvalMonth_(req.query.eval_month);
  return Object.assign(scheduleFor_(evalMonth), { current_eval_month: currentEvalMonth_(), today: taipeiDate_() });
}

// ---------- 題目範本管理（總公司） ----------

// GET /api/self-eval/templates?category=xxx（選填）
function apiSelfEvalTemplates_(req) {
  const category = req.query.category;
  return Db.where('self_eval_templates', category ? { category: category } : null).sort(byCategoryThenSort_);
}

// POST /api/self-eval/templates  { category, question_zh, question_id, sort_order }
function apiSelfEvalTemplateCreate_(req) {
  requireLevel_(req.actor, ['hq'], '自評題目只有總公司可以管理');
  const b = req.body;
  if (!b.category || !b.question_zh) throw httpError_(400, '請填寫題目類別與題目內容');
  return Db.insert('self_eval_templates', {
    category: b.category,
    question_zh: b.question_zh,
    question_id: b.question_id || null,
    sort_order: b.sort_order === undefined || b.sort_order === '' ? 0 : Number(b.sort_order),
    is_active: b.is_active === undefined ? true : !!b.is_active,
  })[0];
}

// PUT /api/self-eval/templates/:id  { category, question_zh, question_id, sort_order }
function apiSelfEvalTemplateUpdate_(req) {
  requireLevel_(req.actor, ['hq'], '自評題目只有總公司可以管理');
  const b = req.body;
  const updated = Db.update('self_eval_templates', { id: req.params.id }, {
    category: b.category,
    question_zh: b.question_zh,
    question_id: b.question_id,
    sort_order: b.sort_order === undefined || b.sort_order === '' ? null : Number(b.sort_order),
  });
  if (!updated.length) throw httpError_(400, '找不到這個題目');
  return updated[0];
}

// POST /api/self-eval/templates/:id/toggle  { is_active }
function apiSelfEvalTemplateToggle_(req) {
  requireLevel_(req.actor, ['hq'], '自評題目只有總公司可以管理');
  const updated = Db.update('self_eval_templates', { id: req.params.id }, { is_active: !!req.body.is_active });
  if (!updated.length) throw httpError_(400, '找不到這個題目');
  return updated[0];
}

// ---------- 同仁填寫 ----------

// GET /api/self-eval/form?staff_id=xxx&eval_month=2026-07-01（選填，預設目前這一期）
function apiSelfEvalForm_(req) {
  const staffId = req.query.staff_id || req.actor.id;
  requireStaffAccess_(req.actor, staffId);
  const evalMonth = normalizeEvalMonth_(req.query.eval_month);

  const staffRow = Db.first('staff', { id: staffId });
  if (!staffRow) throw httpError_(400, '找不到這位同仁');
  const role = roleById_(staffRow.role_id);
  const roleCategory = ROLE_CATEGORY_MAP[role && role.category] || null;
  const categories = roleCategory ? ['common', roleCategory] : ['common'];

  const templates = Db.where('self_eval_templates', function (t) {
    return categories.indexOf(t.category) >= 0 && t.is_active === true;
  }).sort(byCategoryThenSort_);

  const submission = Db.first('self_eval_submissions', { staff_id: staffId, eval_month: evalMonth });
  const answerMap = {};
  if (submission) {
    Db.whereEq('self_eval_answers', 'submission_id', submission.id).forEach(function (a) { answerMap[a.template_id] = a; });
  }

  const schedule = scheduleFor_(evalMonth);
  return {
    staff: { id: staffRow.id, name: staffRow.name, branch_id: staffRow.branch_id },
    eval_month: evalMonth,
    due_date: schedule.staff_due_date, // 舊欄位名稱，自評提醒 banner 還在用
    staff_due_date: schedule.staff_due_date,
    interview_due_date: schedule.interview_due_date,
    release_date: schedule.release_date,
    today: taipeiDate_(),
    submission: submission || null,
    questions: templates.map(function (t) { return Object.assign(t, { answer: answerMap[t.id] || null }); }),
  };
}

// POST /api/self-eval/save
// { eval_month, answers: [{ template_id, staff_answer, staff_note }], submit: true/false }
// 同仁只能存自己的表；館別一律用帳號目前所屬館別
function apiSelfEvalSave_(req) {
  const actor = req.actor;
  const b = req.body;
  if (b.staff_id && b.staff_id !== actor.id) throw httpError_(403, '只能填寫自己的自評表');
  const evalMonth = normalizeEvalMonth_(b.eval_month);
  const now = nowIso_();

  // 表單和答案一起存：只排隊一次，而且只讀這位同仁、這份表相關的列（見 Db.gs 的 transaction、scope）
  return Db.transaction(function () {
    const submission = Db.upsert('self_eval_submissions', ['staff_id', 'eval_month'], {
      staff_id: actor.id,
      branch_id: actor.branch_id,
      eval_month: evalMonth,
      status: b.submit ? 'submitted' : 'draft',
      due_date: scheduleFor_(evalMonth).staff_due_date,
      submitted_at: b.submit ? now : null,
      updated_at: now,
    }, {
      scope: { column: 'staff_id', value: actor.id },
      guard: function (existing) {
        if (existing && existing.status === 'reviewed') throw httpError_(400, '這份自評表已經完成面談，不能再修改');
      },
    })[0];

    if (Array.isArray(b.answers) && b.answers.length > 0) {
      Db.upsert('self_eval_answers', ['submission_id', 'template_id'], b.answers.map(function (a) {
        return {
          submission_id: submission.id,
          template_id: a.template_id,
          staff_answer: a.staff_answer,
          staff_note: a.staff_note,
        };
      }), { scope: { column: 'submission_id', value: submission.id } });
    }
    return submission;
  });
}

// ---------- 店經理面談 ----------

// GET /api/self-eval/branch-overview?branch_id=xxx&eval_month=2026-07-01
function apiSelfEvalBranchOverview_(req) {
  const branchId = req.query.branch_id;
  requireBranchAccess_(req.actor, branchId);
  const evalMonth = normalizeEvalMonth_(req.query.eval_month);

  const subMap = {};
  Db.where('self_eval_submissions', { branch_id: branchId, eval_month: evalMonth }).forEach(function (s) {
    subMap[s.staff_id] = {
      id: s.id, staff_id: s.staff_id, status: s.status, submitted_at: s.submitted_at, due_date: s.due_date,
      interview_date: s.interview_date, manager_signed_at: s.manager_signed_at,
    };
  });

  return Db.where('staff', { branch_id: branchId, is_active: true }).map(function (s) {
    const role = roleById_(s.role_id);
    return { staff_id: s.id, name: s.name, role_name: role ? role.name : undefined, submission: subMap[s.id] || null };
  });
}

// GET /api/self-eval/submission-detail?submission_id=xxx
function apiSelfEvalSubmissionDetail_(req) {
  const submission = loadSubmission_(req.query.submission_id);
  requireStaffAccess_(req.actor, submission.staff_id);

  const staff = Db.first('staff', { id: submission.staff_id });
  const templates = {};
  Db.all('self_eval_templates').forEach(function (t) { templates[t.id] = t; });

  const answers = Db.whereEq('self_eval_answers', 'submission_id', submission.id).map(function (a) {
    const t = templates[a.template_id];
    return Object.assign(a, {
      template: t ? { category: t.category, question_zh: t.question_zh, question_id: t.question_id, sort_order: t.sort_order } : null,
    });
  }).sort(function (a, b) {
    return ((a.template && a.template.sort_order) || 0) - ((b.template && b.template.sort_order) || 0);
  });

  return { submission: Object.assign(submission, { staff: staff ? { name: staff.name } : null }), answers: answers };
}

// POST /api/self-eval/manager-review
// { submission_id, answers: [{ template_id, manager_answer, manager_note }], interview_notes, interview_date, mark_reviewed }
// mark_reviewed = true 代表「完成面談」，完成後這份表就鎖定
function apiSelfEvalManagerReview_(req) {
  const actor = req.actor;
  requireLevel_(actor, ['hq', 'manager'], '只有主管可以進行面談');
  const b = req.body;
  const current = loadSubmission_(b.submission_id);
  requireBranchAccess_(actor, current.branch_id);

  if (current.status === 'reviewed') throw httpError_(400, '這份自評表已經完成面談，不能再修改');
  // 面談是在同仁送出之後才進行，還是草稿的表不能被主管鎖定
  if (b.mark_reviewed && current.status !== 'submitted') throw httpError_(400, '同仁還沒送出自評表，不能完成面談');

  const patch = {
    manager_interview_notes: b.interview_notes,
    interview_date: b.interview_date || null,
    updated_at: nowIso_(),
  };
  if (b.mark_reviewed) {
    patch.status = 'reviewed';
    patch.manager_signed_at = nowIso_();
    if (!patch.interview_date) patch.interview_date = taipeiDate_();
  }

  // 主管意見和面談紀錄一起存，只排隊一次
  return Db.transaction(function () {
    if (Array.isArray(b.answers) && b.answers.length) {
      const scope = { column: 'submission_id', value: current.id };
      const patches = {};
      Db.whereEq('self_eval_answers', 'submission_id', current.id).forEach(function (row) {
        const a = b.answers.find(function (x) { return x.template_id === row.template_id; });
        if (a) patches[row.id] = { manager_answer: a.manager_answer, manager_note: a.manager_note };
      });
      // 只改已經存在的答案（跟原本的 update 一樣）
      Db.updateById('self_eval_answers', patches, { scope: scope });
    }
    return Db.update('self_eval_submissions', { id: current.id }, patch)[0];
  });
}

// ---------- 總公司：各館自評進度 ----------

// 一位同仁在某一期的進度
function progressRow_(person, sub, schedule, today) {
  const submitted = !!sub && (sub.status === 'submitted' || sub.status === 'reviewed');
  const reviewed = !!sub && sub.status === 'reviewed';
  const submittedOn = submitted ? taipeiDate_(sub.submitted_at) : null;
  const reviewedOn = reviewed ? taipeiDate_(sub.manager_signed_at) : null;
  return {
    staff_id: person.staff_id,
    name: person.name,
    role_name: person.role_name,
    inactive: !!person.inactive,
    // 同仁填寫：done 已送出 / draft 草稿 / not_started 尚未開始
    fill_status: submitted ? 'done' : sub ? 'draft' : 'not_started',
    submitted_on: submittedOn,
    submitted_late: !!submittedOn && submittedOn > schedule.staff_due_date,
    fill_overdue: !submitted && today > schedule.staff_due_date,
    // 主管面談：done 已完成 / pending 還沒
    interview_status: reviewed ? 'done' : 'pending',
    interview_date: (sub && sub.interview_date) || null,
    reviewed_on: reviewedOn,
    reviewed_late: !!reviewedOn && reviewedOn > schedule.interview_due_date,
    interview_overdue: !reviewed && today > schedule.interview_due_date,
  };
}

// GET /api/self-eval/hq-progress?eval_month=2026-08-01（選填）
// 每個館「同仁填寫」「主管面談」兩個階段的完成人數，以及每位同仁的狀態。
// 不回傳作答內容——勾「否」不代表異常，那是同仁跟主管面談改善的起點。
function apiSelfEvalHqProgress_(req) {
  requireLevel_(req.actor, ['hq'], '各館自評進度只有總公司可以查看');
  const evalMonth = normalizeEvalMonth_(req.query.eval_month);
  const schedule = scheduleFor_(evalMonth);
  const today = taipeiDate_();
  const current = currentEvalMonth_();

  const allSubs = Db.all('self_eval_submissions');
  const subs = allSubs.filter(function (s) { return s.eval_month === evalMonth; });

  // 月份選項：從最早有人填的那一期到目前這一期（最多 24 期），新的在前
  const earliest = allSubs.map(function (s) { return s.eval_month; }).filter(Boolean).sort()[0];
  const earliestYm = earliest ? earliest.slice(0, 7) : null;
  const months = [];
  for (let ym = current.slice(0, 7); months.length < 24; ym = addMonths_(ym, -1)) {
    months.push(ym + '-01');
    if (!earliestYm || ym <= earliestYm) break;
  }
  if (months.indexOf(evalMonth) < 0) months.push(evalMonth);
  months.sort().reverse();

  // 應填名單：目前在職的同仁，加上這一期有填過但之後停用的同仁（歷史月份才不會少算）
  // 館別以填寫當時存下來的為準，還沒填的就用目前所屬館別
  const people = {};
  Db.where('staff', { is_active: true }).forEach(function (s) {
    const role = roleById_(s.role_id);
    people[s.id] = { staff_id: s.id, name: s.name, role_name: role ? role.name : null, branch_id: s.branch_id };
  });
  const subByStaff = {};
  subs.forEach(function (sub) {
    subByStaff[sub.staff_id] = sub;
    const person = people[sub.staff_id];
    if (person) {
      if (sub.branch_id) person.branch_id = sub.branch_id;
    } else {
      const s = Db.first('staff', { id: sub.staff_id });
      const role = s ? roleById_(s.role_id) : null;
      people[sub.staff_id] = {
        staff_id: sub.staff_id,
        name: s ? s.name : '（已停用的同仁）',
        role_name: role ? role.name : null,
        branch_id: sub.branch_id,
        inactive: true,
      };
    }
  });

  const peopleList = Object.keys(people).map(function (k) { return people[k]; });
  const branches = Db.all('branches').map(function (b) {
    const staff = peopleList
      .filter(function (p) { return p.branch_id === b.id; })
      .map(function (p) { return progressRow_(p, subByStaff[p.staff_id], schedule, today); })
      .sort(byName_);
    return {
      branch_id: b.id,
      branch_name: b.name,
      is_hq: b.code === 'HQ',
      total: staff.length,
      fill_done: staff.filter(function (s) { return s.fill_status === 'done'; }).length,
      interview_done: staff.filter(function (s) { return s.interview_status === 'done'; }).length,
      fill_overdue: staff.filter(function (s) { return s.fill_overdue; }).length,
      interview_overdue: staff.filter(function (s) { return s.interview_overdue; }).length,
      staff: staff,
    };
  })
    // 總公司自己排最後，其他館依名稱
    .sort(function (a, b) { return Number(a.is_hq) - Number(b.is_hq) || String(a.branch_name).localeCompare(String(b.branch_name), 'zh-Hant'); });

  return Object.assign({}, schedule, { today: today, current_eval_month: current, months: months, branches: branches });
}
