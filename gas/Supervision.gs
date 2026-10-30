// ============================================================
// 管轄：哪位面談主管負責哪些同仁
//
// 原本「誰面談誰」是用職務＋館別推算（店經理管自己館別）。公司組織扁平，一個人常常管好幾個部門
// 或個別同仁，所以改成在「帳號管理」直接指定：某位主管管轄哪些同仁。
//
//   - 能當面談主管的帳號層級：經理、總辦公室（見 Levels.gs 的 canSuperviseLevel_）；
//     總辦公室預設不管轄任何人，需要時把人加進自己的管轄就能面談
//   - 被管轄的人必須是要填自評的層級（現場人員、經理）；經理可以管轄經理
//   - 一位同仁可以有多位主管，任何一位完成面談就算完成（自評表記錄是誰面談的）
//   - 面談一律只限自己的管轄人員（沒有「代為面談」）
//   - 經理還可以管理自己管轄的現場人員的帳號
//   - 設定管轄關係：總公司行政、總辦公室
//
// 有效的管轄關係：主管在職、層級仍然能當主管；被管轄的人層級仍然要填自評。
// 不符合的關係只是暫時忽略（不刪資料），例如主管停用後再啟用，原本的管轄會自動恢復。
// 被管轄的同仁停用時關係仍然有效（主管才能把他重新啟用、查看他以前的自評），
// 只是不會出現在要面談的名單裡。
// ============================================================

function canBeSupervisor_(staff) {
  if (!staff || staff.is_active !== true) return false;
  return canSuperviseLevel_(levelOf_(staff, staff.roles));
}

// 能不能被管轄（要填自評的層級）
function canBeSupervised_(staff) {
  return !!staff && fillsSelfEval_(levelOf_(staff, staff.roles));
}

// 所有「有效的」管轄關係
function activeSupervisions_() {
  const staffById = {};
  Db.all('staff').forEach(function (s) { staffById[s.id] = s; });
  return Db.all('supervisions').filter(function (r) {
    return r.supervisor_id !== r.staff_id && canBeSupervisor_(staffById[r.supervisor_id]) &&
      canBeSupervised_(staffById[r.staff_id]);
  });
}

// 這位同仁目前的主管 id 清單
function supervisorsOf_(staffId) {
  return activeSupervisions_()
    .filter(function (r) { return r.staff_id === staffId; })
    .map(function (r) { return r.supervisor_id; });
}

// 這位主管目前管轄的同仁 id 清單
function superviseesOf_(supervisorId) {
  return activeSupervisions_()
    .filter(function (r) { return r.supervisor_id === supervisorId; })
    .map(function (r) { return r.staff_id; });
}

function isSupervisorOf_(actor, staffId) {
  return supervisorsOf_(staffId).indexOf(actor.id) >= 0;
}

// { 同仁 id: [主管 id, …] }，列表一次算好，避免每個人各讀一次
function supervisorMap_() {
  const map = {};
  activeSupervisions_().forEach(function (r) {
    (map[r.staff_id] = map[r.staff_id] || []).push(r.supervisor_id);
  });
  return map;
}

// 把一串同仁 id 換成名字（找不到的略過）
function staffNames_(ids) {
  return (ids || []).map(function (id) {
    const s = Db.first('staff', { id: id });
    return s ? s.name : null;
  }).filter(Boolean);
}

// ---------- API（限總公司行政、總辦公室） ----------

function requireCanSetSupervision_(actor) {
  requireLevelFn_(actor, canSetSupervision_, '只有總公司行政、總辦公室可以設定管轄人員');
}

function loadSupervisor_(id) {
  const supervisor = Db.first('staff', { id: id });
  if (!supervisor) throw httpError_(404, '找不到這位主管');
  return supervisor;
}

// GET /api/supervisions/:supervisorId → { supervisor, staff_ids }
// 回傳「設定上」的管轄名單（含暫時無效的，例如停用中的同仁），編輯畫面才不會不小心把他們拿掉
function apiSupervisionsGet_(req) {
  requireCanSetSupervision_(req.actor);
  const supervisor = loadSupervisor_(req.params.supervisorId);
  return {
    supervisor: { id: supervisor.id, name: supervisor.name, can_supervise: canBeSupervisor_(supervisor) },
    staff_ids: Db.where('supervisions', { supervisor_id: supervisor.id }).map(function (r) { return r.staff_id; }),
  };
}

// PUT /api/supervisions/:supervisorId  { staff_ids: [...] }：整批取代這位主管的管轄名單
function apiSupervisionsPut_(req) {
  requireCanSetSupervision_(req.actor);
  const supervisor = loadSupervisor_(req.params.supervisorId);
  if (!canBeSupervisor_(supervisor)) {
    throw httpError_(400, '只有帳號層級是經理或總辦公室的在職帳號可以設定管轄人員');
  }
  const ids = Array.isArray(req.body.staff_ids) ? req.body.staff_ids : [];
  const wanted = {};
  ids.forEach(function (id) {
    if (id === supervisor.id) throw httpError_(400, '不能管轄自己');
    const member = Db.first('staff', { id: id });
    if (!member) throw httpError_(400, '找不到其中一位同仁，請重新整理後再試');
    if (!canBeSupervised_(member)) throw httpError_(400, '「' + member.name + '」的帳號層級不需要自評，不能被管轄');
    wanted[id] = true;
  });

  return Db.transaction(function () {
    const existing = Db.where('supervisions', { supervisor_id: supervisor.id });
    const have = {};
    existing.forEach(function (r) { have[r.staff_id] = true; });
    const removed = Db.remove('supervisions', function (r) { return r.supervisor_id === supervisor.id && !wanted[r.staff_id]; });
    const toAdd = Object.keys(wanted).filter(function (id) { return !have[id]; });
    Db.insert('supervisions', toAdd.map(function (id) {
      return { supervisor_id: supervisor.id, staff_id: id, created_by: req.actor.id };
    }));
    return { ok: true, added: toAdd.length, removed: removed, staff_ids: Object.keys(wanted) };
  });
}

// ---------- 初始管轄（試算表選單，見 Setup.gs） ----------

// 依「部門」建立初始管轄：每位在職的經理（層級）→ 同部門所有在職的現場人員。
// 經理彼此、總辦公室的管轄不自動建立，之後在帳號管理設定。
// 管轄表已經有資料時不執行，除非 opts.replace（先清空再重建，會蓋掉調整過的設定）。
function seedSupervisionsByBranch_(opts) {
  const existing = Db.all('supervisions').length;
  if (existing > 0 && !(opts && opts.replace)) {
    return { created: 0, skipped: true, existing: existing };
  }
  const active = Db.where('staff', { is_active: true });
  const rows = [];
  active.forEach(function (manager) {
    if (levelOf_(manager) !== 'manager') return;
    active.forEach(function (s) {
      if (s.id !== manager.id && s.branch_id === manager.branch_id && levelOf_(s) === 'field') {
        rows.push({ supervisor_id: manager.id, staff_id: s.id, created_by: 'seed' });
      }
    });
  });
  return Db.transaction(function () {
    const removed = existing > 0 ? Db.remove('supervisions', function () { return true; }) : 0;
    Db.insert('supervisions', rows);
    return { created: rows.length, removed: removed, skipped: false };
  });
}
