// ============================================================
// 每月評核：彙整、送審、審核定案（2026-11 起，取代原本的 Excel 計算）
//
// 流程（一個月一份，狀態存在 appraisal_months）：
//   1. 彙整中（draft）：人事行政在「評核彙整」頁確認還有誰沒評、哪些資料沒填（例如客戶評價），
//      頁面上的分數與獎金是「即時試算」
//   2. 送審（submitted）：人事行政（或總辦公室）按「送審」，系統把當下的計算結果存一份到 appraisal_results，
//      資料沒填完也可以送；送審後評分有變動，頁面會提醒，要重新送審才會更新
//   3. 定案（approved）：任何一位總辦公室按「審核完成」，記錄是誰核准的。定案後這個月的評分、客戶評價都不能改，
//      除非總辦公室按「修改」（回到彙整中，之後要重新送審、審核）
//   人事行政、總辦公室隨時可以回來看之前月份的資料。
//
// 計算（同原本評核表計算器）：
//   每個項目：所有人的評分（A=100、B=80、C=60、D=0）直接平均、四捨五入；客戶評價這類項目用輸入的分數
//   最後分數＝平均＋獎懲（獎懲功能之後做，目前一律 0，會加在「接獎懲」的項目）
//   獎金＝最後分數 × 個人獎金基數；最後分數未滿 60 這一項沒有獎金。當月獎金＝各項目加總
// ============================================================

const APPRAISAL_FIRST_MONTH = '2026-11-01';
const APPRAISAL_PASS_SCORE = 60;
const APPRAISAL_STATUS_LABELS = { draft: '彙整中', submitted: '已送審，等總辦公室審核', approved: '已定案' };
const APPRAISAL_HISTORY_LABELS = { submit: '送審', approve: '審核完成（定案）', reopen: '改回可修改' };

// ---------- 月份狀態 ----------

function appraisalMonthRow_(evalMonth) {
  return Db.first('appraisal_months', { eval_month: evalMonth });
}

function appraisalMonthStatus_(evalMonth) {
  const row = appraisalMonthRow_(evalMonth);
  return row && row.status ? row.status : 'draft';
}

// 定案的月份不能再改評分、客戶評價
function requireMonthEditable_(evalMonth) {
  if (appraisalMonthStatus_(evalMonth) === 'approved') {
    throw httpError_(400, Number(evalMonth.slice(5, 7)) + ' 月的評核已經定案，不能再修改；需要修改請總辦公室在「評核彙整」按「修改」');
  }
}

// 彙整頁預設看哪個月：已經開放評分的最近一個月（21 號以後是本月，之前是上個月）；測試站一律本月
function defaultSummaryMonth_() {
  const today = taipeiDate_();
  const ym = today.slice(0, 7);
  const opened = isStaging_() || Number(today.slice(8, 10)) >= APPRAISAL_SCHEDULE.openDay;
  const month = (opened ? ym : addMonths_(ym, -1)) + '-01';
  return month < APPRAISAL_FIRST_MONTH ? APPRAISAL_FIRST_MONTH : month;
}

// 可以選的月份：第一個月到本月，新的在前
function summaryMonthOptions_() {
  const last = taipeiDate_().slice(0, 7) + '-01';
  const list = [];
  for (let m = APPRAISAL_FIRST_MONTH; m <= last && list.length < 120; m = addMonths_(m.slice(0, 7), 1) + '-01') list.push(m);
  return list.reverse();
}

function addHistory_(row, action, actorId) {
  let history = [];
  try { history = JSON.parse((row && row.history) || '[]'); } catch (e) { history = []; }
  history.push({ action: action, by: actorId, at: nowIso_() });
  return JSON.stringify(history);
}

// ---------- 計算 ----------

function gradePoints_(grade) {
  return Object.prototype.hasOwnProperty.call(APPRAISAL_GRADE_POINTS, grade) ? APPRAISAL_GRADE_POINTS[grade] : null;
}

// 這個月每位同仁的結果（即時計算）。名單＝目前要被評核的人，加上這個月已經有人評過、但之後停用的人
function computeAppraisalResults_(ctx, evalMonth) {
  const byRatee = {};
  Db.where('appraisal_ratings', { eval_month: evalMonth }).forEach(function (r) {
    (byRatee[r.ratee_id] = byRatee[r.ratee_id] || []).push(r);
  });
  const inputs = {};
  Db.where('appraisal_inputs', { eval_month: evalMonth }).forEach(function (i) { inputs[i.staff_id + '|' + i.item_id] = i; });
  const overrides = baseOverrides_();
  const nameOf = function (id) { return ctx.staffById[id] ? ctx.staffById[id].name : '（已刪除的帳號）'; };

  const ids = {};
  Object.keys(ctx.staffById).forEach(function (id) { if (isAppraisee_(ctx, ctx.staffById[id])) ids[id] = true; });
  Object.keys(byRatee).forEach(function (id) {
    const s = ctx.staffById[id];
    if (s && appraisalItemsOf_(ctx, s).length) ids[id] = true;
  });

  return Object.keys(ids).map(function (id) {
    const s = ctx.staffById[id];
    const ratings = byRatee[id] || [];
    const items = appraisalItemsOf_(ctx, s).map(function (item) {
      let average = null;
      let entries = [];
      let note = '';
      if (item.source === 'input') {
        const inp = inputs[id + '|' + item.id];
        if (inp && inp.score !== null && inp.score !== '' && inp.score !== undefined) average = Math.round(Number(inp.score));
        note = inp ? (inp.note || '') : '';
      } else {
        entries = ratings.map(function (r) {
          const grade = parseGrades_(r.grades)[item.id];
          const points = gradePoints_(grade);
          return points === null ? null : { rater_id: r.rater_id, rater_name: nameOf(r.rater_id), grade: grade, points: points };
        }).filter(Boolean);
        if (entries.length) {
          average = Math.round(entries.reduce(function (sum, e) { return sum + e.points; }, 0) / entries.length);
        }
      }
      const reward = 0; // 獎懲功能之後做
      const final = average === null ? null : Math.max(0, average + reward);
      const base = effectiveBase_(s, item, overrides);
      const bonus = final !== null && final >= APPRAISAL_PASS_SCORE ? Math.round(final * base) : 0;
      return {
        item_id: item.id, name: item.name, source: item.source || 'main', takes_reward: item.takes_reward === true,
        ratings: entries, average: average, reward: reward, final: final, base: base, bonus: bonus, note: note,
      };
    });
    const branch = branchById_(s.branch_id);
    const role = ctx.roles[s.role_id];
    const tags = [];
    if (s.is_part_time) tags.push('兼職');
    if (s.is_intern) tags.push('實習生');
    if (ctx.levelOf(s) === 'manager') tags.push('主管');
    if (s.is_active !== true) tags.push('已停用');
    return {
      staff_id: id,
      name: s.name,
      branch_name: branch ? branch.name : '（沒有部門）',
      role_name: role ? role.name : '',
      tags: tags,
      items: items,
      comments: ratings.filter(function (r) { return String(r.comment || '').trim(); })
        .map(function (r) { return { rater_name: nameOf(r.rater_id), comment: r.comment }; }),
      total_bonus: items.reduce(function (sum, i) { return sum + i.bonus; }, 0),
      missing_count: items.filter(function (i) { return i.final === null; }).length,
    };
  }).sort(function (a, b) {
    return String(a.branch_name).localeCompare(String(b.branch_name), 'zh-Hant') || byName_(a, b);
  });
}

// 送審時存下來的結果
function savedAppraisalResults_(evalMonth) {
  return Db.where('appraisal_results', { eval_month: evalMonth }).map(function (r) {
    try { return JSON.parse(r.data); } catch (e) { return null; }
  }).filter(Boolean).sort(function (a, b) {
    return String(a.branch_name).localeCompare(String(b.branch_name), 'zh-Hant') || byName_(a, b);
  });
}

// 這個月評分、客戶評價最後一次變動的時間（判斷送審後有沒有新的變動）
function lastAppraisalChange_(evalMonth) {
  let last = '';
  ['appraisal_ratings', 'appraisal_inputs'].forEach(function (table) {
    Db.where(table, { eval_month: evalMonth }).forEach(function (r) {
      const t = String(r.updated_at || r.created_at || '');
      if (t > last) last = t;
    });
  });
  return last;
}

// 還沒完成的資料：誰還沒評完、哪些人哪些項目還沒有分數（含客戶評價沒填）、職務沒對應評核類別的人
function appraisalChecks_(ctx, evalMonth, live) {
  const progress = appraisalProgress_(ctx, evalMonth);
  return {
    raters_pending: progress.raters
      .filter(function (r) { return r.required_done < r.required_total; })
      .map(function (r) {
        return { name: r.name, branch_name: r.branch_name, level_label: r.level_label, done: r.required_done, total: r.required_total, missing_names: r.missing_names };
      }),
    missing_scores: live.filter(function (p) { return p.missing_count > 0; }).map(function (p) {
      return {
        name: p.name, branch_name: p.branch_name,
        items: p.items.filter(function (i) { return i.final === null; }).map(function (i) { return i.name; }),
      };
    }),
    no_required_rater: progress.no_required_rater,
    no_items: progress.no_items,
  };
}

// 需要人事行政輸入的項目（例如客戶評價）：每位同仁、每個項目目前的分數
function appraisalInputRows_(live) {
  return live.map(function (p) {
    const items = p.items.filter(function (i) { return i.source === 'input'; })
      .map(function (i) { return { item_id: i.item_id, name: i.name, score: i.average, note: i.note }; });
    return items.length ? { staff_id: p.staff_id, name: p.name, branch_name: p.branch_name, items: items } : null;
  }).filter(Boolean);
}

// ---------- API（人事行政、總辦公室） ----------

// GET /api/appraisal/summary?eval_month=2026-11
function apiAppraisalSummary_(req) {
  const actor = req.actor;
  requireLevelFn_(actor, canManageAppraisal_, '評核彙整只有人事行政、總辦公室可以查看');
  const evalMonth = cleanEvalMonth_(req.query.eval_month) || defaultSummaryMonth_();
  return appraisalSummaryResponse_(actor, evalMonth);
}

function appraisalSummaryResponse_(actor, evalMonth) {
  const row = appraisalMonthRow_(evalMonth);
  const status = row && row.status ? row.status : 'draft';
  const ctx = appraisalContext_();
  const live = computeAppraisalResults_(ctx, evalMonth);
  const people = status === 'draft' ? live : savedAppraisalResults_(evalMonth);
  const nameOf = function (id) { return id ? (ctx.staffById[id] ? ctx.staffById[id].name : '（已刪除的帳號）') : ''; };
  let history = [];
  try { history = JSON.parse((row && row.history) || '[]'); } catch (e) { history = []; }
  const canApprove = canApproveAppraisal_(actor.level);
  const editable = status !== 'approved';

  return {
    eval_month: evalMonth,
    months: summaryMonthOptions_(),
    window: appraisalWindow_(evalMonth),
    status: status,
    status_label: APPRAISAL_STATUS_LABELS[status],
    submitted_by_name: nameOf(row && row.submitted_by),
    submitted_at: row ? row.submitted_at || '' : '',
    approved_by_name: status === 'approved' ? nameOf(row.approved_by) : '',
    approved_at: status === 'approved' ? row.approved_at || '' : '',
    history: history.map(function (h) {
      return { label: APPRAISAL_HISTORY_LABELS[h.action] || h.action, by_name: nameOf(h.by), at: h.at };
    }),
    // 送審後評分、客戶評價又有變動：提醒重新送審
    changed_since_submit: status === 'submitted' && lastAppraisalChange_(evalMonth) > String(row.submitted_at || ''),
    is_live: status === 'draft',
    pass_score: APPRAISAL_PASS_SCORE,
    people: people,
    total_bonus: people.reduce(function (sum, p) { return sum + (p.total_bonus || 0); }, 0),
    checks: editable ? appraisalChecks_(ctx, evalMonth, live) : null,
    inputs: editable ? appraisalInputRows_(live) : [],
    can_submit: editable,
    can_approve: canApprove && status === 'submitted',
    can_reopen: canApprove && status === 'approved',
    can_edit_inputs: editable,
  };
}

function requireSummaryMonth_(req) {
  const evalMonth = cleanEvalMonth_(req.body.eval_month);
  if (!evalMonth) throw httpError_(400, '請選擇月份');
  if (evalMonth < APPRAISAL_FIRST_MONTH) throw httpError_(400, '這個月份還沒有使用系統評核');
  return evalMonth;
}

// POST /api/appraisal/summary/submit  { eval_month }：依當下資料送審（資料沒填完也可以送）
function apiAppraisalSubmit_(req) {
  const actor = req.actor;
  requireLevelFn_(actor, canManageAppraisal_, '只有人事行政、總辦公室可以送審');
  const evalMonth = requireSummaryMonth_(req);
  requireMonthEditable_(evalMonth);
  const results = computeAppraisalResults_(appraisalContext_(), evalMonth);
  const keep = idSet_(results.map(function (p) { return p.staff_id; }));
  Db.transaction(function () {
    Db.upsert('appraisal_results', ['eval_month', 'staff_id'], results.map(function (p) {
      return { eval_month: evalMonth, staff_id: p.staff_id, data: JSON.stringify(p), total_bonus: p.total_bonus };
    }));
    // 上次送審有、這次沒有的人（例如職務改成不評核）
    if (Db.where('appraisal_results', { eval_month: evalMonth }).some(function (r) { return !keep[r.staff_id]; })) {
      Db.remove('appraisal_results', function (r) { return r.eval_month === evalMonth && !keep[r.staff_id]; });
    }
    const row = appraisalMonthRow_(evalMonth);
    Db.upsert('appraisal_months', ['eval_month'], {
      eval_month: evalMonth, status: 'submitted', submitted_by: actor.id, submitted_at: nowIso_(),
      approved_by: '', approved_at: '', history: addHistory_(row, 'submit', actor.id),
    });
  });
  return appraisalSummaryResponse_(actor, evalMonth);
}

// POST /api/appraisal/summary/approve  { eval_month }：總辦公室審核完成，這個月定案
function apiAppraisalApprove_(req) {
  const actor = req.actor;
  requireLevelFn_(actor, canApproveAppraisal_, '只有總辦公室可以審核定案');
  const evalMonth = requireSummaryMonth_(req);
  const row = appraisalMonthRow_(evalMonth);
  if (!row || row.status !== 'submitted') throw httpError_(400, '這個月還沒有送審（或已經定案），請重新整理');
  Db.update('appraisal_months', { eval_month: evalMonth }, {
    status: 'approved', approved_by: actor.id, approved_at: nowIso_(), history: addHistory_(row, 'approve', actor.id),
  });
  return appraisalSummaryResponse_(actor, evalMonth);
}

// POST /api/appraisal/summary/reopen  { eval_month }：定案的月份改回可修改（之後要重新送審、審核）
function apiAppraisalReopen_(req) {
  const actor = req.actor;
  requireLevelFn_(actor, canApproveAppraisal_, '只有總辦公室可以修改已定案的評核');
  const evalMonth = requireSummaryMonth_(req);
  const row = appraisalMonthRow_(evalMonth);
  if (!row || row.status !== 'approved') throw httpError_(400, '這個月還沒有定案，請重新整理');
  Db.update('appraisal_months', { eval_month: evalMonth }, {
    status: 'draft', history: addHistory_(row, 'reopen', actor.id),
  });
  return appraisalSummaryResponse_(actor, evalMonth);
}

// PUT /api/appraisal/inputs  { eval_month, staff_id, item_id, score（0～100，空白＝清除）, note }
function apiAppraisalInputSave_(req) {
  const actor = req.actor;
  requireLevelFn_(actor, canManageAppraisal_, '只有人事行政、總辦公室可以輸入');
  const evalMonth = requireSummaryMonth_(req);
  requireMonthEditable_(evalMonth);
  const ctx = appraisalContext_();
  const s = ctx.staffById[req.body.staff_id];
  const item = s && appraisalItemsOf_(ctx, s).find(function (i) { return i.id === req.body.item_id; });
  if (!item || item.source !== 'input') throw httpError_(400, '這位同仁沒有這個要輸入的項目，請重新整理');
  const raw = req.body.score;
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    Db.remove('appraisal_inputs', function (r) { return r.eval_month === evalMonth && r.staff_id === s.id && r.item_id === item.id; });
    return { ok: true, score: null };
  }
  const score = Number(raw);
  if (Number.isNaN(score) || score < 0 || score > 100) throw httpError_(400, '分數要填 0～100');
  Db.upsert('appraisal_inputs', ['eval_month', 'staff_id', 'item_id'], {
    eval_month: evalMonth, staff_id: s.id, item_id: item.id, score: score,
    note: String(req.body.note || '').trim(), updated_by: actor.id,
  });
  return { ok: true, score: score };
}
