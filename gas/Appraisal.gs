// ============================================================
// 每月評核（2026-11 起，取代 Google 表單＋評核表計算器）
//
// 時程（台灣時間，月份＝評分當下的月份）：
//   每月 1～10 號  同仁填自評、20 號前主管面談（SelfEval.gs）
//   每月 21 號～月底 評核評分（這支檔案）；主管評分時看得到這位同仁當月的自評和面談紀錄
//   隔月 5 號前    人事行政填客戶評價、總辦公室核定獎懲並發布（第二批，之後做）
//   測試站不受開放時間限制，方便測試
//
// 評核項目：每個職務指定一個「評核類別」（roles.appraisal_group_id），類別底下有幾個項目（appraisal_items）。
//   項目的 source 決定誰來評：
//     main  主要項目（例如影響力分數）：管轄他的主管評；總辦公室可以評任何人；
//           兼職、實習生的主要項目，同部門的現場正職也要評（一人一票平均）
//     peer  同事內評：管轄這個部門的主管，由部門裡的現場正職評
//     input 不用評分，由人事行政輸入（例如客戶評價，第二批）
//
// 名單每次都依「目前」的帳號、部門、管轄設定即時算出來，不用每個月改表單。
// 分數：A=100、B=80、C=60、D=0，同一個項目所有人的評分直接平均（第二批計算時使用）。
// ============================================================

const APPRAISAL_SCHEDULE = { openDay: 21, publishDay: 5 };
const APPRAISAL_GRADES = ['A', 'B', 'C', 'D'];
const APPRAISAL_GRADE_POINTS = { A: 100, B: 80, C: 60, D: 0 };
const APPRAISAL_SOURCES = [
  { key: 'main', label: '主要項目', hint: '管轄的主管評；總辦公室可以評；兼職、實習生另由同部門正職一起評' },
  { key: 'peer', label: '同事內評', hint: '管轄這個部門的主管，由部門裡的現場正職評' },
  { key: 'input', label: '人事行政輸入', hint: '不用評分，由人事行政每月輸入（例如客戶評價）' },
];

// 共通的 A～D 說明（項目沒有自己的說明時使用，內容同原本評核表的「分數說明」）
const APPRAISAL_GRADE_GUIDE = [
  'A（100 分）｜能完整達成主管要求，並主動思考問題的根本原因與長期改善方式。除完成本職工作外，亦能提前檢查、預防錯誤，主動協助團隊解決問題。工作態度積極正向，並能帶動團隊形成良好工作氛圍。',
  'B（80 分）｜能完整且準確地完成主管交付的任務，日常工作品質穩定，無明顯疏失。工作態度積極正向，面對工作與問題時能保持良好配合度，不輕易抱怨或散播負面情緒。',
  'C（60 分）｜基本上能完成主管交付的任務，但在理解工作目的、執行方法及成果完整度上仍有進步空間，應避免僅以完成交辦為目標。工作態度需更加主動積極，並學習妥善管理情緒，避免影響工作表現。',
  'D（0 分）｜未能妥善完成或回報主管交付的任務，日常工作中仍有重複錯誤、重大疏失或未依規範執行的情形。工作態度或情緒已影響團隊合作與現場運作，應立即提出具體改善措施並接受後續追蹤。',
].join('\n');

// ---------- 時程 ----------

function currentAppraisalMonth_() {
  return taipeiDate_().slice(0, 7) + '-01';
}

function lastDayOfMonth_(ym) {
  const parts = ym.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1], 0)).toISOString().slice(0, 10);
}

// state：upcoming 還沒開放／open 開放中／closed 已截止
function appraisalWindow_(evalMonth) {
  const ym = evalMonth.slice(0, 7);
  const openDate = ym + '-' + pad2_(APPRAISAL_SCHEDULE.openDay);
  const closeDate = lastDayOfMonth_(ym);
  const today = taipeiDate_();
  const state = today < openDate ? 'upcoming' : today > closeDate ? 'closed' : 'open';
  return {
    eval_month: evalMonth,
    open_date: openDate,
    close_date: closeDate,
    publish_due_date: addMonths_(ym, 1) + '-' + pad2_(APPRAISAL_SCHEDULE.publishDay),
    today: today,
    state: state,
    // 測試站不受開放時間限制
    testing_override: state !== 'open' && isStaging_(),
  };
}

function canRateNow_(win) {
  return win.state === 'open' || win.testing_override;
}

// ---------- 名單規則 ----------

// 兼職、實習生：由同部門正職一起評分、自己不用評別人、沒有評核獎金
function isJuniorStaff_(s) {
  return !!s && (s.is_part_time === true || s.is_intern === true);
}

// 一次把要用的資料讀好（每個 API 呼叫一次），避免每個人各算一次
function appraisalContext_() {
  const ctx = { staffById: {}, roles: {}, groupActive: {}, itemsByGroup: {}, itemById: {} };
  Db.all('staff').forEach(function (s) { ctx.staffById[s.id] = s; });
  Db.all('roles').forEach(function (r) { ctx.roles[r.id] = r; });
  Db.all('appraisal_groups').forEach(function (g) { if (g.is_active !== false) ctx.groupActive[g.id] = g; });
  Db.all('appraisal_items').filter(function (i) { return i.is_active !== false; }).sort(bySortOrder_).forEach(function (i) {
    ctx.itemById[i.id] = i;
    (ctx.itemsByGroup[i.group_id] = ctx.itemsByGroup[i.group_id] || []).push(i);
  });
  ctx.levelOf = function (s) { return levelOf_(s, ctx.roles[s.role_id]); };
  // 管轄：{ 主管: [同仁] }、{ 部門: [主管] }
  ctx.superviseesBy = {};
  activeSupervisions_().forEach(function (r) {
    (ctx.superviseesBy[r.supervisor_id] = ctx.superviseesBy[r.supervisor_id] || []).push(r.staff_id);
  });
  ctx.supervisorsOfBranch = {};
  activeBranchSupervisions_().forEach(function (r) {
    (ctx.supervisorsOfBranch[r.branch_id] = ctx.supervisorsOfBranch[r.branch_id] || []).push(r.supervisor_id);
  });
  ctx.hasSupervisor = {};
  Object.keys(ctx.superviseesBy).forEach(function (sup) {
    ctx.superviseesBy[sup].forEach(function (id) { ctx.hasSupervisor[id] = true; });
  });
  return ctx;
}

// 這位同仁要被評的項目（職務沒有指定評核類別、或類別停用時是空的）
function appraisalItemsOf_(ctx, s) {
  const role = ctx.roles[s.role_id];
  const gid = role && role.appraisal_group_id;
  return gid && ctx.groupActive[gid] ? (ctx.itemsByGroup[gid] || []) : [];
}

// 要被評核的人：在職、要填自評的層級（現場人員、主管），而且職務有評核項目
function isAppraisee_(ctx, s) {
  return !!s && s.is_active === true && fillsSelfEval_(ctx.levelOf(s)) && appraisalItemsOf_(ctx, s).length > 0;
}

// 要評同事的現場正職（兼職、實習生不用評別人）
function isPeerRater_(ctx, s) {
  return !!s && s.is_active === true && ctx.levelOf(s) === 'field' && !isJuniorStaff_(s);
}

// 這位評分者這個月要評誰、評哪些項目：{ 同仁 id: { sources, required, suggested, relations } }
//   required：一定要評（管轄的主管、同部門正職）；suggested：總辦公室建議評（主管、或沒有其他人評的同仁）
function appraisalAssignments_(ctx, rater) {
  const map = {};
  const level = ctx.levelOf(rater);
  const add = function (rateeId, source, required, relation) {
    const ratee = ctx.staffById[rateeId];
    if (!ratee || rateeId === rater.id || !isAppraisee_(ctx, ratee)) return;
    const a = map[rateeId] = map[rateeId] || { sources: {}, required: false, suggested: false, relations: [] };
    a.sources[source] = true;
    if (required) a.required = true;
    if (a.relations.indexOf(relation) < 0) a.relations.push(relation);
  };

  if (rater.is_active !== true) return map;

  // 管轄的主管：評主要項目
  if (canSuperviseLevel_(level)) {
    (ctx.superviseesBy[rater.id] || []).forEach(function (id) { add(id, 'main', true, '你管轄的同仁'); });
  }

  // 總辦公室：可以評任何人的主要項目（選填）；主管、沒有主管的同仁建議要評
  if (level === 'office') {
    Object.keys(ctx.staffById).forEach(function (id) {
      const s = ctx.staffById[id];
      if (!isAppraisee_(ctx, s) || id === rater.id) return;
      add(id, 'main', false, '總辦公室');
      if (map[id] && (ctx.levelOf(s) === 'manager' || !ctx.hasSupervisor[id])) map[id].suggested = true;
    });
  }

  // 現場正職：同部門的兼職、實習生（主要項目），以及管轄這個部門的主管（同事內評）
  if (isPeerRater_(ctx, rater) && rater.branch_id) {
    Object.keys(ctx.staffById).forEach(function (id) {
      const s = ctx.staffById[id];
      if (s.branch_id === rater.branch_id && isJuniorStaff_(s)) add(id, 'main', true, '同部門的兼職／實習生');
    });
    (ctx.supervisorsOfBranch[rater.branch_id] || []).forEach(function (id) {
      const s = ctx.staffById[id];
      if (s && ctx.levelOf(s) === 'manager') add(id, 'peer', true, '同事內評（管轄你部門的主管）');
    });
  }

  // 只留下真的有項目可以評的人
  Object.keys(map).forEach(function (id) {
    if (appraisalItemsFor_(ctx, ctx.staffById[id], map[id].sources).length === 0) delete map[id];
  });
  return map;
}

// 評分者要評這位同仁的哪些項目（依關係的 source 篩選，input 類不用評）
function appraisalItemsFor_(ctx, ratee, sources) {
  return appraisalItemsOf_(ctx, ratee).filter(function (i) { return i.source !== 'input' && sources[i.source || 'main']; });
}

function parseGrades_(text) {
  if (!text) return {};
  try {
    const obj = JSON.parse(text);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}

function publicItem_(i) {
  return {
    id: i.id, name: i.name, description: i.description || '', grade_desc: i.grade_desc || '',
    source: i.source || 'main',
  };
}

// ---------- 評分（所有要評分的人） ----------

// GET /api/appraisal/mine
function apiAppraisalMine_(req) {
  const actor = req.actor;
  const evalMonth = currentAppraisalMonth_();
  const win = appraisalWindow_(evalMonth);
  const ctx = appraisalContext_();
  const me = ctx.staffById[actor.id];
  const assignments = me ? appraisalAssignments_(ctx, me) : {};

  const ratings = {};
  Db.whereEq('appraisal_ratings', 'rater_id', actor.id).forEach(function (r) {
    if (r.eval_month === evalMonth) ratings[r.ratee_id] = r;
  });
  // 看得到自評的人：管轄的主管、人事行政、總辦公室（同 SelfEval.gs 的 requireStaffAccess_）
  const canSeeAllSelfEval = canViewAllSelfEval_(actor.level);
  const subs = {};
  Db.where('self_eval_submissions', { eval_month: evalMonth }).forEach(function (s) { subs[s.staff_id] = s; });

  const ratees = Object.keys(assignments).map(function (id) {
    const s = ctx.staffById[id];
    const a = assignments[id];
    const items = appraisalItemsFor_(ctx, s, a.sources);
    const rating = ratings[id];
    const grades = rating ? parseGrades_(rating.grades) : {};
    const done = items.every(function (i) { return APPRAISAL_GRADES.indexOf(grades[i.id]) >= 0; });
    const branch = branchById_(s.branch_id);
    const role = ctx.roles[s.role_id];
    const sub = subs[id];
    const showSelfEval = canSeeAllSelfEval || (ctx.superviseesBy[actor.id] || []).indexOf(id) >= 0;
    const tags = [];
    if (s.is_part_time) tags.push('兼職');
    if (s.is_intern) tags.push('實習生');
    if (ctx.levelOf(s) === 'manager') tags.push('主管');
    return {
      staff_id: id,
      name: s.name,
      branch_id: s.branch_id,
      branch_name: branch ? branch.name : '（沒有部門）',
      role_name: role ? role.name : '',
      tags: tags,
      relations: a.relations,
      required: a.required,
      suggested: a.suggested,
      items: items.map(publicItem_),
      rating: rating ? { grades: grades, comment: rating.comment || '', updated_at: rating.updated_at } : null,
      done: !!rating && done,
      self_eval: showSelfEval ? (sub ? { submission_id: sub.id, status: sub.status } : { submission_id: null, status: 'not_started' }) : null,
    };
  }).sort(function (a, b) {
    return String(a.branch_name).localeCompare(String(b.branch_name), 'zh-Hant') || byName_(a, b);
  });

  const canFeedback = isPeerRater_(ctx, me);
  const feedback = canFeedback ? Db.whereEq('appraisal_feedback', 'staff_id', actor.id).find(function (f) {
    return f.eval_month === evalMonth;
  }) : null;
  const required = ratees.filter(function (r) { return r.required; });

  return {
    window: win,
    can_rate_now: canRateNow_(win),
    grade_guide: APPRAISAL_GRADE_GUIDE,
    is_junior: isJuniorStaff_(me),
    can_feedback: canFeedback,
    feedback: feedback ? { feedback: feedback.feedback || '', updated_at: feedback.updated_at } : null,
    required_total: required.length,
    required_done: required.filter(function (r) { return r.done; }).length,
    ratees: ratees,
  };
}

function requireRatingOpen_() {
  const win = appraisalWindow_(currentAppraisalMonth_());
  requireMonthEditable_(win.eval_month);
  if (!canRateNow_(win)) {
    throw httpError_(400, win.state === 'upcoming'
      ? '這個月的評核 ' + win.open_date.slice(5).replace('-', '/') + ' 才開放評分'
      : '這個月的評核已經截止');
  }
  return win;
}

// POST /api/appraisal/rate  { ratee_id, grades: { 項目 id: 'A'～'D' }, comment }
function apiAppraisalRate_(req) {
  const actor = req.actor;
  const win = requireRatingOpen_();
  const ctx = appraisalContext_();
  const me = ctx.staffById[actor.id];
  const rateeId = req.body.ratee_id;
  const a = me ? appraisalAssignments_(ctx, me)[rateeId] : null;
  if (!a) throw httpError_(403, '你這個月不用評這位同仁');

  const items = appraisalItemsFor_(ctx, ctx.staffById[rateeId], a.sources);
  const input = req.body.grades || {};
  const grades = {};
  items.forEach(function (i) {
    const g = String(input[i.id] || '').toUpperCase();
    if (APPRAISAL_GRADES.indexOf(g) < 0) throw httpError_(400, '請幫「' + i.name + '」選一個分數（A～D）');
    grades[i.id] = g;
  });
  const comment = String(req.body.comment || '').trim();

  const saved = Db.upsert('appraisal_ratings', ['eval_month', 'rater_id', 'ratee_id'], {
    eval_month: win.eval_month,
    rater_id: actor.id,
    ratee_id: rateeId,
    grades: JSON.stringify(grades),
    comment: comment,
  }, { scope: { column: 'rater_id', value: actor.id } })[0];
  return { ok: true, rating: { grades: grades, comment: comment, updated_at: saved.updated_at } };
}

// POST /api/appraisal/feedback  { feedback }
function apiAppraisalFeedback_(req) {
  const actor = req.actor;
  const win = requireRatingOpen_();
  const ctx = appraisalContext_();
  const me = ctx.staffById[actor.id];
  if (!isPeerRater_(ctx, me)) throw httpError_(403, '回饋與期望由現場正職同仁填寫');
  const saved = Db.upsert('appraisal_feedback', ['eval_month', 'staff_id'], {
    eval_month: win.eval_month,
    staff_id: actor.id,
    branch_id: me.branch_id,
    feedback: String(req.body.feedback || '').trim(),
  },{ scope: { column: 'staff_id', value: actor.id } })[0];
  return { ok: true, updated_at: saved.updated_at };
}

// ---------- 評分進度（人事行政、總辦公室） ----------

// GET /api/appraisal/progress?eval_month=
function apiAppraisalProgress_(req) {
  requireLevelFn_(req.actor, canManageAppraisal_, '評分進度只有人事行政、總辦公室可以查看');
  const evalMonth = cleanEvalMonth_(req.query.eval_month) || currentAppraisalMonth_();
  return appraisalProgress_(appraisalContext_(), evalMonth);
}

// 每位評分者「一定要評」的人數與完成人數，還沒評的名單；另外列出「沒有任何人評」的同仁，避免漏評
// （名單依目前的帳號與管轄設定計算）
function appraisalProgress_(ctx, evalMonth) {
  const ratingsBy = {};
  const ratedPeople = {};
  Db.where('appraisal_ratings', { eval_month: evalMonth }).forEach(function (r) {
    (ratingsBy[r.rater_id] = ratingsBy[r.rater_id] || {})[r.ratee_id] = parseGrades_(r.grades);
    ratedPeople[r.ratee_id] = (ratedPeople[r.ratee_id] || 0) + 1;
  });

  const coverage = {}; // 同仁 → 一定要評他的人數
  const raters = [];
  Object.keys(ctx.staffById).forEach(function (id) {
    const s = ctx.staffById[id];
    if (s.is_active !== true) return;
    const assignments = appraisalAssignments_(ctx, s);
    const ids = Object.keys(assignments);
    if (!ids.length) return;
    const mine = ratingsBy[id] || {};
    const isDone = function (rateeId) {
      const grades = mine[rateeId];
      if (!grades) return false;
      return appraisalItemsFor_(ctx, ctx.staffById[rateeId], assignments[rateeId].sources)
        .every(function (i) { return APPRAISAL_GRADES.indexOf(grades[i.id]) >= 0; });
    };
    const required = ids.filter(function (rid) { return assignments[rid].required; });
    required.forEach(function (rid) { coverage[rid] = (coverage[rid] || 0) + 1; });
    const branch = branchById_(s.branch_id);
    raters.push({
      staff_id: id,
      name: s.name,
      level_label: levelLabel_(ctx.levelOf(s)),
      branch_name: branch ? branch.name : '（沒有部門）',
      required_total: required.length,
      required_done: required.filter(isDone).length,
      optional_done: ids.filter(function (rid) { return !assignments[rid].required && isDone(rid); }).length,
      missing_names: required.filter(function (rid) { return !isDone(rid); })
        .map(function (rid) { return ctx.staffById[rid].name; }),
    });
  });

  const appraisees = Object.keys(ctx.staffById).filter(function (id) { return isAppraisee_(ctx, ctx.staffById[id]); });
  const nameOf = function (id) { return ctx.staffById[id].name; };
  return {
    window: appraisalWindow_(evalMonth),
    raters: raters.sort(function (a, b) {
      return String(a.branch_name).localeCompare(String(b.branch_name), 'zh-Hant') || byName_(a, b);
    }),
    appraisee_total: appraisees.length,
    // 沒有人「一定要評」的同仁：只能靠總辦公室評，名單要確認（例如管轄沒設定）
    no_required_rater: appraisees.filter(function (id) { return !coverage[id]; }).map(nameOf).sort(),
    // 到目前為止還沒有任何評分的同仁
    not_rated_yet: appraisees.filter(function (id) { return !ratedPeople[id]; }).map(nameOf).sort(),
    // 在職、要填自評，但職務還沒有指定評核類別的同仁（不會被評核）
    no_items: Object.keys(ctx.staffById).filter(function (id) {
      const s = ctx.staffById[id];
      return s.is_active === true && fillsSelfEval_(ctx.levelOf(s)) && appraisalItemsOf_(ctx, s).length === 0;
    }).map(nameOf).sort(),
  };
}

// ---------- 評核項目設定（總辦公室） ----------

function requireAppraisalAdmin_(actor) {
  requireLevelFn_(actor, canManageAppraisal_, '評核項目與獎金基數只有人事行政、總辦公室可以設定');
}

// 網頁送來的評核月份（2026-11 或 2026-11-01）→ '2026-11-01'；格式不對回 null
function cleanEvalMonth_(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-01' : null;
}

function cleanNumber_(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) throw httpError_(400, '金額要填 0 以上的數字');
  return n;
}

// GET /api/appraisal/settings
function apiAppraisalSettings_(req) {
  requireAppraisalAdmin_(req.actor);
  const counts = countBy_(Db.where('staff', { is_active: true }), 'role_id');
  const items = Db.all('appraisal_items').sort(bySortOrder_);
  return {
    sources: APPRAISAL_SOURCES,
    grade_guide: APPRAISAL_GRADE_GUIDE,
    groups: Db.all('appraisal_groups').sort(bySortOrder_).map(function (g) {
      return {
        id: g.id, name: g.name, sort_order: g.sort_order || 0, is_active: g.is_active !== false,
        items: items.filter(function (i) { return i.group_id === g.id; }).map(function (i) {
          return {
            id: i.id, name: i.name, description: i.description || '', grade_desc: i.grade_desc || '',
            source: i.source || 'main', default_base: i.default_base || 0, takes_reward: i.takes_reward === true,
            sort_order: i.sort_order || 0, is_active: i.is_active !== false,
          };
        }),
      };
    }),
    roles: Db.all('roles').filter(function (r) { return r.is_active !== false; }).sort(byName_).map(function (r) {
      return { id: r.id, name: r.name, appraisal_group_id: r.appraisal_group_id || '', staff_count: counts[r.id] || 0 };
    }),
  };
}

// POST /api/appraisal/groups  { name }
function apiAppraisalGroupCreate_(req) {
  requireAppraisalAdmin_(req.actor);
  const name = cleanText_(req.body.name);
  if (!name) throw httpError_(400, '請填寫評核類別名稱');
  if (Db.first('appraisal_groups', { name: name })) throw httpError_(400, '已經有叫「' + name + '」的評核類別');
  return Db.insert('appraisal_groups', { name: name, sort_order: Db.all('appraisal_groups').length + 1, is_active: true })[0];
}

// PUT /api/appraisal/groups/:id  { name?, is_active? }
function apiAppraisalGroupUpdate_(req) {
  requireAppraisalAdmin_(req.actor);
  const group = Db.first('appraisal_groups', { id: req.params.id });
  if (!group) throw httpError_(404, '找不到這個評核類別');
  const patch = {};
  if (req.body.name !== undefined) {
    const name = cleanText_(req.body.name);
    if (!name) throw httpError_(400, '請填寫評核類別名稱');
    if (Db.all('appraisal_groups').some(function (g) { return g.name === name && g.id !== group.id; })) {
      throw httpError_(400, '已經有叫「' + name + '」的評核類別');
    }
    patch.name = name;
  }
  if (req.body.is_active !== undefined) patch.is_active = !!req.body.is_active;
  return Db.update('appraisal_groups', { id: group.id }, patch)[0];
}

function itemPatch_(body) {
  const patch = {};
  if (body.name !== undefined) {
    patch.name = cleanText_(body.name);
    if (!patch.name) throw httpError_(400, '請填寫項目名稱');
  }
  if (body.description !== undefined) patch.description = String(body.description || '').trim();
  if (body.grade_desc !== undefined) patch.grade_desc = String(body.grade_desc || '').trim();
  if (body.source !== undefined) {
    if (!APPRAISAL_SOURCES.some(function (s) { return s.key === body.source; })) throw httpError_(400, '請選擇誰來評');
    patch.source = body.source;
  }
  if (body.default_base !== undefined) patch.default_base = cleanNumber_(body.default_base) || 0;
  if (body.takes_reward !== undefined) patch.takes_reward = !!body.takes_reward;
  if (body.sort_order !== undefined && body.sort_order !== '') patch.sort_order = Number(body.sort_order) || 0;
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;
  return patch;
}

// 一個類別只能有一個項目接獎懲：設定新的時，把同類別其他項目取消
function clearOtherRewardItems_(groupId, keepId) {
  const patches = {};
  Db.where('appraisal_items', { group_id: groupId }).forEach(function (i) {
    if (i.id !== keepId && i.takes_reward === true) patches[i.id] = { takes_reward: false };
  });
  Db.updateById('appraisal_items', patches);
}

// POST /api/appraisal/items  { group_id, name, description, grade_desc, source, default_base, takes_reward }
function apiAppraisalItemCreate_(req) {
  requireAppraisalAdmin_(req.actor);
  const group = Db.first('appraisal_groups', { id: req.body.group_id });
  if (!group) throw httpError_(400, '找不到這個評核類別');
  const patch = itemPatch_(Object.assign({ source: 'main', default_base: 0 }, req.body));
  if (!patch.name) throw httpError_(400, '請填寫項目名稱');
  return Db.transaction(function () {
    const created = Db.insert('appraisal_items', Object.assign({
      group_id: group.id, is_active: true, sort_order: Db.where('appraisal_items', { group_id: group.id }).length + 1,
    }, patch))[0];
    if (created.takes_reward) clearOtherRewardItems_(group.id, created.id);
    return created;
  });
}

// PUT /api/appraisal/items/:id  { 同上，都可以只給要改的 }
function apiAppraisalItemUpdate_(req) {
  requireAppraisalAdmin_(req.actor);
  const item = Db.first('appraisal_items', { id: req.params.id });
  if (!item) throw httpError_(404, '找不到這個項目');
  const patch = itemPatch_(req.body);
  return Db.transaction(function () {
    const updated = Db.update('appraisal_items', { id: item.id }, patch)[0];
    if (patch.takes_reward) clearOtherRewardItems_(item.group_id, item.id);
    return updated;
  });
}

// PUT /api/appraisal/roles/:id  { appraisal_group_id }（空白＝這個職務不評核）
function apiAppraisalRoleUpdate_(req) {
  requireAppraisalAdmin_(req.actor);
  const role = Db.first('roles', { id: req.params.id });
  if (!role) throw httpError_(404, '找不到這個職務');
  const gid = req.body.appraisal_group_id || '';
  if (gid && !Db.first('appraisal_groups', { id: gid })) throw httpError_(400, '找不到這個評核類別');
  return Db.update('roles', { id: role.id }, { appraisal_group_id: gid || null })[0];
}

// ---------- 個人獎金基數（總辦公室） ----------

// 實際使用的基數：有個人設定用個人的；沒有的話兼職、實習生是 0，其他人用項目預設
function effectiveBase_(s, item, overrides) {
  const key = s.id + '|' + item.id;
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
  return isJuniorStaff_(s) ? 0 : (item.default_base || 0);
}

function baseOverrides_() {
  const map = {};
  Db.all('appraisal_bases').forEach(function (b) {
    if (b.base !== null && b.base !== undefined) map[b.staff_id + '|' + b.item_id] = b.base;
  });
  return map;
}

// GET /api/appraisal/bases：每位要評核的同仁、他的項目、預設與實際基數
function apiAppraisalBases_(req) {
  requireAppraisalAdmin_(req.actor);
  const ctx = appraisalContext_();
  const overrides = baseOverrides_();
  return Object.keys(ctx.staffById).map(function (id) { return ctx.staffById[id]; })
    .filter(function (s) { return isAppraisee_(ctx, s); })
    .map(function (s) {
      const branch = branchById_(s.branch_id);
      const role = ctx.roles[s.role_id];
      return {
        staff_id: s.id,
        name: s.name,
        branch_name: branch ? branch.name : '（沒有部門）',
        role_name: role ? role.name : '',
        is_junior: isJuniorStaff_(s),
        items: appraisalItemsOf_(ctx, s).map(function (i) {
          const key = s.id + '|' + i.id;
          return {
            id: i.id, name: i.name,
            default_base: isJuniorStaff_(s) ? 0 : (i.default_base || 0),
            base: effectiveBase_(s, i, overrides),
            custom: Object.prototype.hasOwnProperty.call(overrides, key),
          };
        }),
      };
    })
    .sort(function (a, b) { return String(a.branch_name).localeCompare(String(b.branch_name), 'zh-Hant') || byName_(a, b); });
}

// PUT /api/appraisal/bases/:staffId  { bases: { 項目 id: 金額 或 null（改回預設） } }
function apiAppraisalBasesUpdate_(req) {
  requireAppraisalAdmin_(req.actor);
  const s = Db.first('staff', { id: req.params.staffId });
  if (!s) throw httpError_(404, '找不到這位同仁');
  const bases = req.body.bases || {};
  return Db.transaction(function () {
    Object.keys(bases).forEach(function (itemId) {
      if (!Db.first('appraisal_items', { id: itemId })) throw httpError_(400, '找不到其中一個評核項目，請重新整理後再試');
      const value = cleanNumber_(bases[itemId]);
      if (value === null) {
        Db.remove('appraisal_bases', function (b) { return b.staff_id === s.id && b.item_id === itemId; });
      } else {
        Db.upsert('appraisal_bases', ['staff_id', 'item_id'], {
          staff_id: s.id, item_id: itemId, base: value, updated_at: nowIso_(), updated_by: req.actor.id,
        });
      }
    });
    return { ok: true };
  });
}
