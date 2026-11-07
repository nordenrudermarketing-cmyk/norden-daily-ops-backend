// ============================================================
// 例行任務（2026-11 起，先做「主管」層級）
//
// 總公司在「例行任務設定」維護任務（routine_items），系統依日期自動把任務排給執行人：
//   週：週一到週日一輪，期限是 due_weekday（1＝週一…7＝週日，預設週日）；
//       times＝這週要做幾次，按鈕會顯示「完成 (1/2)」「完成 (2/2)」
//   月：每月一輪，start_day 那天出現、due_day 是期限（31＝月底，月份比較短時自動算到月底）；
//       同一類的事合併成一個任務，steps（每行「日｜要做的事」）提醒每個時間點，最後一次送出完成
//   年：每年一輪，remind_month 那個月開始提醒，不壓期限（due_hint 只是文字提示）；
//       沒做完就一直留著（積壓），直到有人回報
//
// 誰來做：看「管轄部門」（Supervision.gs 的 branch_supervisions）。任務適用的部門
//   （branch_ids 空白＝全部）每個部門各算一份；管轄這個部門的主管都看得到，
//   任何一位回報就算這個部門完成，並記錄是誰、寫了什麼。
//
// 回報（routine_reports，一次回報一列）：
//   done   完成一次，可以附說明（任務有 report_hint 時必填）；超過期限才完成要寫逾期原因
//   missed 未能完成，要寫原因；這一輪就算結案
// 不做來回確認：回報就是結果，有問題大家在 LINE 群組直接討論。
//
// 新增的任務從「建立那天」開始算，不會一建立就冒出一堆過去沒做的。
// 擴充：之後要給其他層級用，在 ROUTINE_AUDIENCES 加一筆，routine_items.audience 填新的值。
// ============================================================

const ROUTINE_PERIODS = { week: '每週', month: '每月', year: '每年' };
const ROUTINE_AUDIENCES = { manager: { label: '主管', level: 'manager' } };
const ROUTINE_WEEKDAYS = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];
// 撤回自己回報的時限
const ROUTINE_UNDO_HOURS = 24;
// 年度任務最多往回看幾年的積壓
const ROUTINE_BACKLOG_YEARS = 2;

// ---------- 日期（一律用台灣日期字串 'YYYY-MM-DD' 計算） ----------

function rtPad_(n) {
  return (n < 10 ? '0' : '') + n;
}

function rtDate_(ymd) {
  const p = ymd.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] || 1));
}

function rtAddDays_(ymd, n) {
  const d = rtDate_(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 1＝週一 … 7＝週日
function rtWeekday_(ymd) {
  const w = rtDate_(ymd).getUTCDay();
  return w === 0 ? 7 : w;
}

// 某年某月的第 day 天；超過月底就算月底
function rtDayOfMonth_(year, month, day) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return year + '-' + rtPad_(month) + '-' + rtPad_(Math.min(day, last));
}

function rtMd_(ymd) {
  return Number(ymd.slice(5, 7)) + '/' + Number(ymd.slice(8, 10));
}

function rtDayLabel_(ymd) {
  return rtMd_(ymd) + '（' + ROUTINE_WEEKDAYS[rtWeekday_(ymd)].slice(1) + '）';
}

// ---------- 每一輪的代號：週＝那週的週一、月＝'YYYY-MM'、年＝'YYYY' ----------

function rtCurrentKey_(period, today) {
  if (period === 'week') return rtAddDays_(today, 1 - rtWeekday_(today));
  if (period === 'month') return today.slice(0, 7);
  return today.slice(0, 4);
}

function rtShiftKey_(period, key, n) {
  if (period === 'week') return rtAddDays_(key, 7 * n);
  if (period === 'month') {
    let y = Number(key.slice(0, 4));
    let m = Number(key.slice(5, 7)) + n;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    return y + '-' + rtPad_(m);
  }
  return String(Number(key) + n);
}

function rtValidKey_(period, key) {
  const k = String(key || '');
  if (period === 'week') return /^\d{4}-\d{2}-\d{2}$/.test(k) && rtWeekday_(k) === 1;
  if (period === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(k);
  return /^\d{4}$/.test(k);
}

function rtKeyLabel_(period, key) {
  if (period === 'week') return rtMd_(key) + '–' + rtMd_(rtAddDays_(key, 6));
  if (period === 'month') return key.slice(0, 4) + ' 年 ' + Number(key.slice(5, 7)) + ' 月';
  return key + ' 年';
}

// 這一輪什麼時候開始出現、期限是哪天（年度任務沒有期限）
function rtDates_(item, key) {
  if (item.period === 'week') return { start: key, due: rtAddDays_(key, (item.due_weekday || 7) - 1) };
  if (item.period === 'month') {
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(5, 7));
    return { start: rtDayOfMonth_(y, m, item.start_day || 1), due: rtDayOfMonth_(y, m, item.due_day || 31) };
  }
  return { start: key + '-' + rtPad_(item.remind_month || 1) + '-01', due: null };
}

// 新增的任務從建立那天開始算：週、月看期限有沒有在建立之後；年看提醒月份有沒有在建立的月份之後
function rtApplies_(item, key) {
  const created = item.created_at ? taipeiDate_(item.created_at) : null;
  if (!created) return true;
  const d = rtDates_(item, key);
  if (item.period === 'year') return d.start >= created.slice(0, 7) + '-01';
  return d.due >= created;
}

function rtBranchIds_(item) {
  return String(item.branch_ids || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

// 這個任務適用這個部門嗎（branch_ids 空白＝全部）
function rtForBranch_(item, branchId) {
  const ids = rtBranchIds_(item);
  return ids.length === 0 || ids.indexOf(branchId) >= 0;
}

// steps：每行「日｜要做的事」，例如「10｜依假表排班」
function rtSteps_(text) {
  return String(text || '').split(/\r?\n/).map(function (line) {
    const m = line.match(/^\s*(\d{1,2})\s*[｜|:：]\s*(.+?)\s*$/);
    return m ? { day: Number(m[1]), text: m[2] } : null;
  }).filter(Boolean).sort(function (a, b) { return a.day - b.day; });
}

function rtDueLabel_(item, dates) {
  if (item.period === 'week') return ROUTINE_WEEKDAYS[item.due_weekday || 7] + '（' + rtMd_(dates.due) + '）前';
  if (item.period === 'month') return rtMd_(dates.due) + ' 前';
  return (item.remind_month || 1) + ' 月提醒' + (item.due_hint ? '・' + item.due_hint : '');
}

// ---------- 組出「某任務 × 某部門 × 某一輪」的狀態 ----------
//   status：open 進行中／upcoming 還沒開始／overdue 逾期／backlog 往年積壓／done 完成／missed 未能完成

function rtStaffNames_() {
  const map = {};
  Db.all('staff').forEach(function (s) { map[s.id] = s.name; });
  return map;
}

function rtPublicReport_(r, names) {
  return {
    id: r.id,
    kind: r.kind,
    note: r.note || '',
    late_reason: r.late_reason || '',
    staff_id: r.staff_id,
    staff_name: names[r.staff_id] || '（已刪除的帳號）',
    created_at: r.created_at,
    at_label: r.created_at ? Utilities.formatDate(new Date(r.created_at), 'Asia/Taipei', 'M/d HH:mm') : '',
  };
}

// reportIndex：{ '任務id|部門id|代號': [回報…] }
function rtReportIndex_(reports) {
  const index = {};
  reports.forEach(function (r) {
    const k = r.item_id + '|' + r.branch_id + '|' + r.period_key;
    (index[k] = index[k] || []).push(r);
  });
  return index;
}

function rtInstance_(item, branch, key, ctx) {
  const today = ctx.today;
  const d = rtDates_(item, key);
  const list = (ctx.index[item.id + '|' + branch.id + '|' + key] || []).slice()
    .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
  const times = item.period === 'year' ? 1 : Math.max(1, item.times || 1);
  const doneCount = list.filter(function (r) { return r.kind === 'done'; }).length;
  const missed = list.some(function (r) { return r.kind === 'missed'; });

  let status = 'open';
  if (doneCount >= times) status = 'done';
  else if (missed) status = 'missed';
  else if (today < d.start) status = 'upcoming';
  else if (d.due && today > d.due) status = 'overdue';
  else if (!d.due && key < today.slice(0, 4)) status = 'backlog';

  // 月任務的時間點：本月的話標出「現在進行到哪一步」
  const steps = rtSteps_(item.steps);
  if (item.period === 'month' && key === today.slice(0, 7)) {
    const day = Number(today.slice(8, 10));
    let current = -1;
    steps.forEach(function (s, i) { if (s.day <= day) current = i; });
    steps.forEach(function (s, i) { s.current = i === current; s.past = i < current; });
  }

  return {
    item_id: item.id,
    branch_id: branch.id,
    branch_name: branch.name,
    period: item.period,
    period_key: key,
    period_label: rtKeyLabel_(item.period, key),
    category: item.category || '',
    title: item.title,
    description: item.description || '',
    report_hint: item.report_hint || '',
    times: times,
    done_count: doneCount,
    status: status,
    start: d.start,
    due: d.due,
    due_label: rtDueLabel_(item, d),
    late: !!(d.due && today > d.due),
    steps: steps,
    reports: list.map(function (r) { return rtPublicReport_(r, ctx.names); }),
  };
}

function rtContext_() {
  return { today: taipeiDate_(), index: rtReportIndex_(Db.all('routine_reports')), names: rtStaffNames_() };
}

function rtActiveItems_(audience) {
  return Db.all('routine_items')
    .filter(function (it) { return it.is_active !== false && (it.audience || 'manager') === audience; })
    .sort(rtItemOrder_);
}

function rtItemOrder_(a, b) {
  const order = { week: 1, month: 2, year: 3 };
  return (order[a.period] - order[b.period]) || ((a.sort_order || 0) - (b.sort_order || 0)) ||
    String(a.title).localeCompare(String(b.title), 'zh-Hant');
}

// 執行人看得到哪幾輪：週、月是這一輪＋上一輪（上一輪只留沒回報的）；年是今年＋往年積壓
function rtVisibleKeys_(period, today) {
  const cur = rtCurrentKey_(period, today);
  if (period === 'year') {
    const keys = [{ key: cur, past: false }];
    for (let i = 1; i <= ROUTINE_BACKLOG_YEARS; i++) keys.push({ key: rtShiftKey_(period, cur, -i), past: true });
    return keys;
  }
  return [{ key: cur, past: false }, { key: rtShiftKey_(period, cur, -1), past: true }];
}

// 這個層級的人是哪一種執行對象（目前只有主管）
function rtAudienceOfLevel_(level) {
  return Object.keys(ROUTINE_AUDIENCES).filter(function (k) { return ROUTINE_AUDIENCES[k].level === level; })[0] || null;
}

// 各部門目前的執行人名字 { 部門 id: [名字…] }：在職、層級符合、管轄這個部門
function rtExecutorMap_(audience) {
  const level = ROUTINE_AUDIENCES[audience].level;
  const staffById = {};
  Db.all('staff').forEach(function (s) { staffById[s.id] = s; });
  const map = {};
  activeBranchSupervisions_().forEach(function (r) {
    const s = staffById[r.supervisor_id];
    if (!s || levelOf_(s) !== level) return;
    (map[r.branch_id] = map[r.branch_id] || []).push(s.name);
  });
  return map;
}

function rtRequireExecutor_(actor) {
  const audience = rtAudienceOfLevel_(actor.level);
  if (!audience) throw httpError_(403, '例行任務目前只開放給主管');
  return audience;
}

// ---------- API：執行人 ----------

// GET /api/routine-tasks/mine：我管轄的部門現在要做的例行任務
function apiRoutineMine_(req) {
  const audience = rtRequireExecutor_(req.actor);
  const ctx = rtContext_();
  const branches = supervisedBranchIdsOf_(req.actor.id).map(branchById_).filter(Boolean).sort(byName_);
  const items = rtActiveItems_(audience);
  const instances = [];
  branches.forEach(function (branch) {
    items.forEach(function (item) {
      if (!rtForBranch_(item, branch.id)) return;
      rtVisibleKeys_(item.period, ctx.today).forEach(function (k) {
        if (!rtApplies_(item, k.key)) return;
        const inst = rtInstance_(item, branch, k.key, ctx);
        // 上一輪、往年：只留還沒回報的
        if (k.past && ['overdue', 'backlog'].indexOf(inst.status) < 0) return;
        // 今年還沒到提醒月份的年度任務不列（月任務的「本月稍後」要列）
        if (inst.status === 'upcoming' && item.period !== 'month') return;
        instances.push(inst);
      });
    });
  });
  return {
    today: ctx.today,
    today_label: rtDayLabel_(ctx.today),
    branches: branches.map(function (b) { return { id: b.id, name: b.name }; }),
    instances: instances,
  };
}

// POST /api/routine-tasks/report { item_id, branch_id, period_key, kind: 'done'|'missed', note, late_reason }
function apiRoutineReport_(req) {
  const actor = req.actor;
  const audience = rtRequireExecutor_(actor);
  const body = req.body;
  const item = Db.first('routine_items', { id: body.item_id });
  if (!item || item.is_active === false || (item.audience || 'manager') !== audience) {
    throw httpError_(404, '找不到這個任務，請重新整理後再試');
  }
  const branch = branchById_(body.branch_id);
  if (!branch || supervisedBranchIdsOf_(actor.id).indexOf(branch.id) < 0) {
    throw httpError_(403, '你沒有管轄這個部門，不能回報');
  }
  if (!rtForBranch_(item, branch.id)) throw httpError_(400, '這個任務不適用這個部門');
  const today = taipeiDate_();
  const key = String(body.period_key || '');
  const visible = rtVisibleKeys_(item.period, today).some(function (k) { return k.key === key; });
  if (!rtValidKey_(item.period, key) || !visible || !rtApplies_(item, key)) {
    throw httpError_(400, '這一輪已經不能回報了，請重新整理');
  }
  const kind = body.kind === 'missed' ? 'missed' : 'done';
  const note = cleanText_(body.note);
  const lateReason = cleanText_(body.late_reason);

  return Db.transaction(function () {
    const ctx = { today: today, index: rtReportIndex_(Db.whereEq('routine_reports', 'period_key', key)), names: {} };
    const inst = rtInstance_(item, branch, key, ctx);
    if (inst.status === 'done') throw httpError_(400, '這一輪已經完成了（可能是其他主管剛回報），請重新整理');
    if (inst.status === 'missed') throw httpError_(400, '這一輪已經回報未能完成，請重新整理');
    if (inst.status === 'upcoming') throw httpError_(400, '這個任務還沒開始');
    if (kind === 'missed' && !note) throw httpError_(400, '請寫下未能完成的原因');
    if (kind === 'done' && inst.late && !lateReason) throw httpError_(400, '已經超過期限，請寫下逾期原因');
    if (kind === 'done' && item.report_hint && !note) throw httpError_(400, '請填寫說明：' + item.report_hint);
    Db.insert('routine_reports', {
      item_id: item.id, branch_id: branch.id, period_key: key, kind: kind,
      note: note, late_reason: kind === 'done' ? lateReason : '', staff_id: actor.id,
    });
    return { ok: true };
  });
}

// DELETE /api/routine-tasks/reports/:id：撤回自己按錯的回報（24 小時內）
function apiRoutineReportDelete_(req) {
  const report = Db.first('routine_reports', { id: req.params.id });
  if (!report) throw httpError_(404, '找不到這筆回報，可能已經撤回了');
  if (report.staff_id !== req.actor.id) throw httpError_(403, '只能撤回自己的回報');
  if (Date.now() - new Date(report.created_at).getTime() > ROUTINE_UNDO_HOURS * 3600000) {
    throw httpError_(400, '超過 ' + ROUTINE_UNDO_HOURS + ' 小時，不能撤回');
  }
  Db.remove('routine_reports', { id: report.id });
  return { ok: true };
}

// ---------- API：總公司看執行狀況 ----------

function rtRequireManager_(actor) {
  requireLevelFn_(actor, canManageRoutine_, '只有總公司行政、總辦公室可以查看與設定例行任務');
}

// 有執行人的部門（管轄部門裡有主管）
function rtBoardBranches_(executors) {
  return Object.keys(executors).map(branchById_)
    .filter(function (b) { return b && b.is_active !== false; })
    .sort(byName_);
}

// 某一輪的「任務 × 部門」表，以及每個部門的完成統計
function rtBoard_(period, key, ctx, audience) {
  const executors = rtExecutorMap_(audience);
  const branches = rtBoardBranches_(executors);
  const items = rtActiveItems_(audience).filter(function (it) { return it.period === period; });
  const stats = {};
  branches.forEach(function (b) { stats[b.id] = { total: 0, done: 0, missed: 0, overdue: 0, open: 0 }; });

  const rows = items.map(function (item) {
    return {
      item_id: item.id,
      category: item.category || '',
      title: item.title,
      times: item.period === 'year' ? 1 : Math.max(1, item.times || 1),
      due_label: rtDueLabel_(item, rtDates_(item, key)),
      cells: branches.map(function (b) {
        if (!rtForBranch_(item, b.id) || !rtApplies_(item, key)) return null;
        const inst = rtInstance_(item, b, key, ctx);
        const s = stats[b.id];
        if (inst.status !== 'upcoming') {
          s.total++;
          if (inst.status === 'done') s.done++;
          else if (inst.status === 'missed') s.missed++;
          else if (inst.status === 'overdue' || inst.status === 'backlog') s.overdue++;
          else s.open++;
        }
        return { status: inst.status, done_count: inst.done_count, times: inst.times, reports: inst.reports };
      }),
    };
  });

  return {
    branches: branches.map(function (b) {
      return { id: b.id, name: b.name, executors: executors[b.id] || [], stats: stats[b.id] };
    }),
    rows: rows,
  };
}

// GET /api/routine-tasks/overview?period=week|month|year&key=（選填，預設這一輪）
function apiRoutineOverview_(req) {
  rtRequireManager_(req.actor);
  const ctx = rtContext_();
  const period = ROUTINE_PERIODS[req.query.period] ? req.query.period : 'week';
  const current = rtCurrentKey_(period, ctx.today);
  const key = rtValidKey_(period, req.query.key) ? String(req.query.key) : current;
  const board = rtBoard_(period, key, ctx, 'manager');
  return Object.assign(board, {
    today: ctx.today,
    period: period,
    key: key,
    label: rtKeyLabel_(period, key),
    is_current: key === current,
    prev_key: rtShiftKey_(period, key, -1),
    next_key: key < current ? rtShiftKey_(period, key, 1) : null,
  });
}

// GET /api/routine-tasks/summary：總辦公室儀表板的各部門摘要（本週、本月、今年＋往年積壓）
function apiRoutineSummary_(req) {
  rtRequireManager_(req.actor);
  const ctx = rtContext_();
  const boards = {};
  ['week', 'month', 'year'].forEach(function (p) {
    boards[p] = rtBoard_(p, rtCurrentKey_(p, ctx.today), ctx, 'manager');
  });
  // 往年積壓：去年、前年還沒回報的年度任務
  const backlog = {};
  for (let i = 1; i <= ROUTINE_BACKLOG_YEARS; i++) {
    rtBoard_('year', rtShiftKey_('year', rtCurrentKey_('year', ctx.today), -i), ctx, 'manager').branches
      .forEach(function (b) { backlog[b.id] = (backlog[b.id] || 0) + b.stats.overdue; });
  }
  return {
    today: ctx.today,
    branches: boards.week.branches.map(function (b, i) {
      return {
        id: b.id,
        name: b.name,
        executors: b.executors,
        week: b.stats,
        month: boards.month.branches[i].stats,
        year: boards.year.branches[i].stats,
        backlog: backlog[b.id] || 0,
      };
    }),
  };
}

// ---------- API：總公司設定任務 ----------

// GET /api/routine-tasks/items：全部任務（含停用的）＋可以選的部門
function apiRoutineItems_(req) {
  rtRequireManager_(req.actor);
  return {
    items: Db.all('routine_items').sort(rtItemOrder_),
    branches: Db.all('branches').filter(function (b) { return b.is_active !== false; }).sort(byName_)
      .map(function (b) { return { id: b.id, name: b.name }; }),
  };
}

function rtIntIn_(value, min, max, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw httpError_(400, label + '要填 ' + min + '～' + max + ' 的整數');
  return n;
}

// 把網頁送來的任務內容整理成要存的欄位（有錯就丟 400）
function rtCleanItem_(body) {
  const period = String(body.period || '');
  if (!ROUTINE_PERIODS[period]) throw httpError_(400, '請選擇週、月或年');
  const title = cleanText_(body.title);
  if (!title) throw httpError_(400, '請填寫任務名稱');

  const ids = (Array.isArray(body.branch_ids) ? body.branch_ids : String(body.branch_ids || '').split(','))
    .map(function (s) { return String(s).trim(); }).filter(Boolean);
  ids.forEach(function (id) { if (!branchById_(id)) throw httpError_(400, '找不到其中一個部門，請重新整理後再試'); });

  const row = {
    audience: ROUTINE_AUDIENCES[body.audience] ? body.audience : 'manager',
    period: period,
    category: cleanText_(body.category) || '其他',
    title: title,
    description: cleanText_(body.description),
    report_hint: cleanText_(body.report_hint),
    branch_ids: ids.join(','),
    times: 1, due_weekday: null, start_day: null, due_day: null, steps: '', remind_month: null, due_hint: '',
    is_active: body.is_active !== false,
  };
  if (period === 'week') {
    row.times = rtIntIn_(body.times || 1, 1, 7, '每週次數');
    row.due_weekday = rtIntIn_(body.due_weekday || 7, 1, 7, '期限（週幾）');
  } else if (period === 'month') {
    row.times = rtIntIn_(body.times || 1, 1, 31, '每月次數');
    row.start_day = rtIntIn_(body.start_day || 1, 1, 31, '開始日');
    row.due_day = rtIntIn_(body.due_day || 31, 1, 31, '期限日');
    if (row.start_day > row.due_day) throw httpError_(400, '開始日不能晚於期限日');
    const lines = String(body.steps || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    lines.forEach(function (line) {
      const step = rtSteps_(line)[0];
      if (!step || step.day < 1 || step.day > 31) {
        throw httpError_(400, '時間點每行要寫成「日｜要做的事」，例如「10｜依假表排班」：' + line);
      }
    });
    row.steps = lines.join('\n');
  } else {
    row.remind_month = rtIntIn_(body.remind_month || 1, 1, 12, '提醒月份');
    row.due_hint = cleanText_(body.due_hint);
  }
  return row;
}

// POST /api/routine-tasks/items
function apiRoutineItemCreate_(req) {
  rtRequireManager_(req.actor);
  const row = rtCleanItem_(req.body);
  const maxOrder = Db.all('routine_items').reduce(function (m, it) { return Math.max(m, it.sort_order || 0); }, 0);
  row.sort_order = maxOrder + 10;
  row.updated_by = req.actor.id;
  return Db.insert('routine_items', row)[0];
}

// PUT /api/routine-tasks/items/:id（停用＝is_active: false；不提供刪除，回報紀錄才不會沒有對應的任務）
function apiRoutineItemUpdate_(req) {
  rtRequireManager_(req.actor);
  const item = Db.first('routine_items', { id: req.params.id });
  if (!item) throw httpError_(404, '找不到這個任務');
  const patch = rtCleanItem_(req.body);
  patch.updated_by = req.actor.id;
  patch.updated_at = nowIso_();
  return Db.update('routine_items', { id: item.id }, patch)[0];
}
