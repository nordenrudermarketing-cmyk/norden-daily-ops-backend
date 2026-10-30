// ============================================================
// 帳號層級：決定權限的唯一依據（2026-10 起）
//
// 系統把三件事分開：
//   部門（branches）＝隸屬哪裡，只用來分組、統計
//   帳號層級（staff.account_level）＝能看到哪些頁面、能管誰——就是這支檔案
//   職務（roles）＝工作內容，只決定自評表有哪些題目（見 Org.gs）
//
// 四個層級，由低到高：
//   field    現場人員    要填自評；只能改自己的密碼
//   manager  經理        要填自評；可以當面談主管；帳號管理＝自己管轄的現場人員
//   hq_admin 總公司行政  人事專用帳號，不填自評、不面談；可以管理經理以下所有帳號、設定管轄、
//                        看所有人的自評（唯讀）和各部門進度
//   office   總辦公室    最高權限（股東、董事），不填自評；可以管理所有帳號（含同級）、設定管轄，
//                        需要時把人加進自己的管轄就能面談；部門、職務、自評題目、功能開關只有這一級能改
//
// 「只能建立、管理比自己低的層級」，總辦公室是唯一例外（可以管同級，避免系統被鎖死）。
// 系統裡所有總辦公室帳號都不能用時，試算表選單有「新增總辦公室帳號」當後門（Setup.gs）。
// ============================================================

const LEVELS = {
  field: { rank: 1, label: '現場人員' },
  manager: { rank: 2, label: '經理' },
  hq_admin: { rank: 3, label: '總公司行政' },
  office: { rank: 4, label: '總辦公室' },
};
const LEVEL_KEYS = ['field', 'manager', 'hq_admin', 'office'];

// 帳號層級。還沒做過「帳號層級轉換」的舊資料（account_level 空白）用職務名稱推算，轉換前系統也不會壞
function levelOf_(staff, role) {
  if (staff && LEVELS[staff.account_level]) return staff.account_level;
  const r = role || (staff ? roleById_(staff.role_id) : null);
  const name = r && r.name;
  if (name === '總公司' || name === '總辦公室經理') return 'office';
  if (name === '店經理' || name === '經理') return 'manager';
  return 'field';
}

function levelRank_(level) {
  return LEVELS[level] ? LEVELS[level].rank : 0;
}

function levelLabel_(level) {
  return LEVELS[level] ? LEVELS[level].label : '';
}

// ---------- 各層級能做的事（其他檔案一律用這些函式判斷，不要再看職務名稱） ----------

// 要填自評、被面談
function fillsSelfEval_(level) {
  return level === 'field' || level === 'manager';
}

// 可以被指定為面談主管（擁有管轄人員）
function canSuperviseLevel_(level) {
  return level === 'manager' || level === 'office';
}

// 看得到所有人的自評（唯讀）與各部門進度
function canViewAllSelfEval_(level) {
  return level === 'hq_admin' || level === 'office';
}

// 可以設定「誰管轄誰」
function canSetSupervision_(level) {
  return level === 'hq_admin' || level === 'office';
}

// 部門、職務、自評題目、功能開關
function isOffice_(level) {
  return level === 'office';
}

// 可以使用帳號管理頁（經理以上）
function canUseAccounts_(level) {
  return levelRank_(level) >= levelRank_('manager');
}

// actor 的層級能不能管理 target 的層級：比自己低才行，總辦公室可以管同級
function outranks_(actorLevel, targetLevel) {
  if (actorLevel === 'office') return true;
  return levelRank_(actorLevel) > levelRank_(targetLevel);
}

// 可以把帳號設成（或建立成）哪些層級
function assignableLevels_(actorLevel) {
  return LEVEL_KEYS.filter(function (key) {
    return actorLevel === 'office' || levelRank_(key) < levelRank_(actorLevel);
  });
}

function requireLevelFn_(actor, check, message) {
  if (!check(actor.level)) throw httpError_(403, message || '你沒有權限使用這個功能');
}

// 給網頁用的層級清單（下拉選單）
function levelOptions_(keys) {
  return keys.map(function (key) { return { key: key, label: levelLabel_(key) }; });
}
