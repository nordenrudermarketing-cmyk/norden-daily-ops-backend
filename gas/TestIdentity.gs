// ============================================================
// 測試站專用：切換測試身分
//
// 測試時每換一種身分都要輸入一次密碼，很花時間。這裡讓「已經用總公司帳號登入」的人，
// 在測試站右下角直接切換成測試帳號（例如測試用的店經理、房務），驗證完再切回總公司。
//
// 安全限制（全部都要符合）：
//   1. 只在測試站有效（試算表名稱含「測試」）；正式站這兩支 API 一律回 404
//   2. 只有總公司本人，或「由總公司切換過來」的身分（登入憑證上記著是誰切的）才能切換
//   3. 只能切換成測試帳號：在職、登入代碼 T- 開頭、而且名字有「測試」；或切回原本的總公司帳號
// 切換後拿到一張新的登入憑證，憑證上記著原本的總公司是誰（有簽章，改不了），所以隨時能切回去。
// ============================================================

function isTestAccount_(staff) {
  return !!staff && staff.is_active === true &&
    /^T-/i.test(String(staff.login_code || '')) && String(staff.name || '').indexOf('測試') >= 0;
}

// 回傳「原本的總公司帳號」；不能切換就丟錯誤
function switchOrigin_(actor) {
  if (!isStaging_()) throw httpError_(404, '找不到這個 API');
  if (actor.switched_by) {
    const origin = Db.first('staff', { id: actor.switched_by });
    const role = origin ? roleById_(origin.role_id) : null;
    if (origin && origin.is_active === true && levelOf_(role && role.name) === 'hq') return origin;
    throw httpError_(403, '原本的總公司帳號已停用或不存在，請重新登入');
  }
  if (actor.level === 'hq') return actor;
  throw httpError_(403, '要先用總公司帳號登入，才能切換測試身分');
}

// GET /api/test/identities
// 可以切換的身分：原本的總公司帳號＋所有測試帳號
function apiTestIdentities_(req) {
  const origin = switchOrigin_(req.actor);
  const accounts = Db.where('staff', function (s) { return isTestAccount_(s) && s.id !== origin.id; })
    .sort(byName_)
    .map(function (s) {
      const role = roleById_(s.role_id);
      const branch = branchById_(s.branch_id);
      return {
        id: s.id,
        name: s.name,
        login_code: s.login_code,
        role_name: role ? role.name : null,
        branch_name: branch ? branch.name : null,
      };
    });
  return { current_id: req.actor.id, origin: { id: origin.id, name: origin.name }, accounts: accounts };
}

// POST /api/test/switch  { staff_id }
// 回傳的內容跟登入（/api/login）一樣，網頁直接存進 localStorage 的 staff 就好
function apiTestSwitch_(req) {
  const origin = switchOrigin_(req.actor);
  const targetId = req.body.staff_id;
  const target = targetId ? Db.first('staff', { id: targetId }) : null;
  const backToOrigin = !!target && target.id === origin.id;
  if (!backToOrigin && !isTestAccount_(target)) {
    throw httpError_(400, '只能切換成測試帳號（登入代碼 T- 開頭、名字有「測試」），或切回原本的總公司帳號');
  }
  const shift = Db.first('staff_schedule', { staff_id: target.id, work_date: taipeiDate_() });
  return {
    id: target.id,
    name: target.name,
    branch_id: target.branch_id,
    role_id: target.role_id,
    is_active: target.is_active,
    roles: roleById_(target.role_id),
    token: issueToken_(target.id, backToOrigin ? null : origin.id),
    todayShiftCode: shift ? shift.shift_code : null,
  };
}
