// ============================================================
// 同仁清單、密碼狀態、當日班別（Railway 版 routes/staff.js、routes/schedule.js 的一部分）
// ============================================================

// 回傳台灣時間的 'YYYY-MM-DD'；沒給值就是今天
function taipeiDate_(value) {
  const date = value === undefined ? new Date() : new Date(value);
  if (value === null || Number.isNaN(date.getTime())) return null;
  return Utilities.formatDate(date, 'Asia/Taipei', 'yyyy-MM-dd');
}

// GET /api/staff/list?branch_id=xxx&category=housekeeping&learning_enabled=true（選填）
// 該館某類職務的在職同仁清單（主管、總公司用）
function apiStaffList_(req) {
  requireLevelFn_(req.actor, canUseAccounts_);
  const q = req.query;
  requireBranchAccess_(req.actor, q.branch_id);
  return Db.where('staff', { branch_id: q.branch_id, is_active: true })
    .map(function (s) { return Object.assign(s, { roles: roleById_(s.role_id) }); })
    .filter(function (s) {
      if (q.category && (!s.roles || s.roles.category !== q.category)) return false;
      if (q.learning_enabled === 'true' && s.learning_map_enabled !== true) return false;
      return true;
    })
    .sort(byName_)
    .map(function (s) {
      return { id: s.id, name: s.name, learning_map_enabled: s.learning_map_enabled, roles: s.roles };
    });
}

// GET /api/staff/password-status?branch_id=xxx（選填，不帶就是全部館別，限總公司）
// 只回傳「有沒有設定密碼」，不會回傳密碼本身或雜湊值
function apiPasswordStatus_(req) {
  requireLevelFn_(req.actor, canUseAccounts_);
  const branchId = req.query.branch_id || null;
  if (branchId) requireBranchAccess_(req.actor, branchId);
  else requireLevelFn_(req.actor, canViewAllSelfEval_);

  const flags = passwordFlags_();
  return Db.where('staff', function (s) { return s.is_active === true && (!branchId || s.branch_id === branchId); })
    .sort(byName_)
    .map(function (s) {
      const branch = branchById_(s.branch_id);
      const role = roleById_(s.role_id);
      return {
        id: s.id,
        name: s.name,
        branch_name: branch ? branch.name : null,
        role_name: role ? role.name : null,
        has_password: !!flags[s.id],
      };
    });
}

// GET /api/schedule/today?staff_id=xxx
// 登入流程用：查今天這位同仁排的班別。
// 一律用台灣時間的「今天」——網頁送來的 date 是用瀏覽器 UTC 算的，台灣早上 8 點前會變成昨天
function apiScheduleToday_(req) {
  const staffId = req.query.staff_id || req.actor.id;
  if (staffId !== req.actor.id) requireLevelFn_(req.actor, canUseAccounts_);
  const row = Db.first('staff_schedule', { staff_id: staffId, work_date: taipeiDate_() });
  return row ? { shift_code: row.shift_code } : null;
}

// GET /api/schedule/team-lead-today?branch_id=xxx
// 今天排班表指定的房務小隊長是誰
function apiTeamLeadToday_(req) {
  const row = Db.first('daily_team_leads', { branch_id: req.query.branch_id, work_date: taipeiDate_() });
  return { staff_id: row ? row.staff_id : null };
}
