// ============================================================
// 功能開關總目錄（唯一的一份定義）
//
// 這裡定義系統裡「一個功能」是由哪些網頁 + 哪些 API 組成的。
// 總公司在「功能開關」頁面關掉某個功能之後：
//   1. 所有人的側邊選單不會出現這些網頁
//   2. 直接打網址進去會被踢回自評表
//   3. 對應的 API 會回 403，所以就算繞過前端也沒用
//
// locked: true 代表不能關（自評表本身、以及總公司要用來開關功能的後台），
//         避免整個系統被鎖死到沒人能開回來。
//
// 之後新增功能時，只要在這個陣列加一筆，前後端都會自動跟上；
// 資料庫沒有那一列的話預設就是「開啟」。
// ============================================================

export const FEATURE_CATALOG = [
  // ---------- 一定會保留的 ----------
  {
    key: 'self_eval',
    label: '每月自評表',
    group: '保留（不可關閉）',
    description: '同仁填寫、主管審閱、總公司題目管理與異常彙總',
    locked: true,
    pages: ['self-eval.html', 'self-eval-review.html', 'self-eval-templates.html', 'self-eval-hq-flagged.html'],
    apis: ['/api/self-eval'],
  },
  {
    key: 'system_admin',
    label: '系統與帳號管理',
    group: '保留（不可關閉）',
    description: '總公司儀表板、功能開關、密碼管理',
    locked: true,
    pages: ['hq-dashboard.html', 'feature-toggles.html', 'manage-passwords.html'],
    // /api/hq 是總公司交辦任務，總公司儀表板自己就靠它，跟著後台一起保留
    apis: ['/api/features', '/api/hq'],
  },

  // ---------- 房務 ----------
  {
    key: 'housekeeping_cleaning',
    label: '房務打掃與房號分配',
    group: '房務',
    description: '今日房號打卡、小隊長分配房號、房務業績獎金',
    pages: ['checklist.html', 'assign.html'],
    apis: ['/api/room-cleanings', '/api/rooms', '/api/bonus'],
  },
  {
    key: 'deep_clean',
    label: '細清排程',
    group: '房務',
    description: '樓主每月細清任務',
    pages: ['deep-clean.html'],
    apis: ['/api/deep-clean'],
  },
  {
    key: 'zone_maintenance',
    label: '責任區／保養排程',
    group: '房務',
    description: '客房責任區保養排程',
    pages: ['zone-maintenance.html'],
    apis: ['/api/room-maintenance'],
  },
  {
    key: 'public_area',
    label: '公區任務與保養',
    group: '房務',
    description: '公區任務分配、公區保養',
    pages: ['public-area.html', 'public-area-assign.html'],
    apis: ['/api/public-area-maintenance'],
  },
  {
    key: 'staff_cleaning',
    label: '個人清潔配額',
    group: '房務',
    description: '同仁個人清潔配額紀錄',
    pages: ['staff-cleaning.html'],
    apis: ['/api/staff-cleaning'],
  },

  // ---------- 客務 ----------
  {
    key: 'frontdesk_shift',
    label: '客務班別任務與巡房檢查',
    group: '客務',
    description: 'A／B班今日任務打卡、C班巡房檢查',
    pages: ['shift.html', 'inspect.html'],
    apis: ['/api/shift-tasks'],
  },
  {
    key: 'handover',
    label: '交班表',
    group: '客務',
    description: '台中館客務交班表',
    pages: ['handover.html'],
    apis: ['/api/handover'],
  },
  {
    key: 'daily_logs',
    label: '客務日誌與客訴登記',
    group: '客務',
    description: '每日客務日誌、客訴登記、No-Show 紀錄',
    pages: ['daily-frontdesk-log.html', 'complaint-register.html', 'no-show.html'],
    apis: ['/api/no-show'],
  },
  {
    key: 'review_check',
    label: '評論回報',
    group: '客務',
    description: '網路評論回報與主管審閱',
    pages: ['review-check.html', 'review-logs-review.html'],
    apis: ['/api/review-checks'],
  },
  {
    key: 'routine_tasks',
    label: '例行事項',
    group: '客務',
    description: '個人例行事項、例行事項管理與匯入',
    pages: ['routine-tasks.html', 'routine-tasks-manage.html', 'routine-tasks-import.html'],
    apis: ['/api/routine-tasks'],
  },
  {
    key: 'shift_templates',
    label: '客務任務範本管理',
    group: '客務',
    description: '店經理維護班別任務項目',
    pages: ['templates.html'],
    apis: ['/api/templates'],
  },

  // ---------- 共用 ----------
  {
    key: 'training',
    label: '培訓與學習地圖',
    group: '共用',
    description: '學習地圖、我的教學任務、指派培訓、四階段考核',
    pages: ['learning-map.html', 'my-teaching.html', 'learning-assign.html'],
    apis: ['/api/training', '/api/assessment'],
  },
  {
    key: 'written_exam',
    label: '考核筆試',
    group: '共用',
    description: '櫃檯考核筆試',
    pages: ['written-exam-take.html'],
    apis: ['/api/written-exam'],
  },
  {
    key: 'bonus_appeals',
    label: '獎金申覆',
    group: '共用',
    description: '同仁申覆與店經理審核',
    pages: ['bonus-appeals.html'],
    apis: ['/api/bonus-appeals'],
  },
  {
    key: 'adhoc_tasks',
    label: '臨時任務',
    group: '共用',
    description: '主管臨時指派的任務',
    pages: ['adhoc-tasks.html'],
    apis: ['/api/adhoc-tasks'],
  },
  {
    key: 'reflections',
    label: '每日反思與週目標',
    group: '共用',
    description: '每日反思、週目標與主管審閱',
    pages: ['daily-reflection.html', 'daily-reflection-review.html', 'weekly-goals.html', 'weekly-goals-review.html'],
    apis: ['/api/reflections'],
  },

  // ---------- 主管／總公司 ----------
  {
    key: 'manager_dashboard',
    label: '店經理儀表板',
    group: '主管',
    description: '店經理登入後的營運總覽',
    pages: ['dashboard.html'],
    apis: ['/api/dashboard'],
  },
  {
    key: 'schedule',
    label: '排班表',
    group: '主管',
    description: '排班表編輯與 Excel 匯入（登入時查當日班別不受影響）',
    pages: ['schedule.html', 'schedule-import.html'],
    apis: ['/api/schedule'],
  },
  {
    key: 'issues',
    label: '異常處理',
    group: '主管',
    description: '缺失回報處理、系統偵測異常',
    pages: ['issues.html'],
    apis: ['/api/issues'],
  },
  {
    key: 'manager_checklist',
    label: '店經理巡館',
    group: '主管',
    description: '每日巡館八項清單',
    pages: ['manager-checklist.html'],
    apis: ['/api/manager-checklist'],
  },
  {
    key: 'manager_reports',
    label: '主管日報與工作表',
    group: '主管',
    description: '開班收班日報、主管每日工作表、各館主管工作日報表',
    pages: ['manager-daily-report.html', 'manager-worksheet.html', 'manager-worksheet-hq.html'],
    apis: ['/api/manager-reports', '/api/manager-memo', '/api/manager-worksheet'],
  },
  {
    key: 'weekly_report',
    label: '各館週報',
    group: '主管',
    description: '總公司看的各館週報',
    pages: ['weekly-report.html'],
    apis: [],
  },
];

// 不管功能開關怎麼設，這些 API 一定放行。
// 少了它們登入流程或側邊選單會直接壞掉。
export const ALWAYS_OPEN_APIS = [
  '/api/health',
  '/api/login',
  '/api/staff',
  '/api/features',
  '/api/schedule/today',
  '/api/schedule/team-lead-today',
];

export const FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key);
export const LOCKED_KEYS = FEATURE_CATALOG.filter((f) => f.locked).map((f) => f.key);

export function getFeature(key) {
  return FEATURE_CATALOG.find((f) => f.key === key) || null;
}

// 路徑是不是落在某個前綴底下（用「整段」比對，避免 /api/bonus 誤中 /api/bonus-appeals）
function matchesPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

export function isAlwaysOpen(pathname) {
  return ALWAYS_OPEN_APIS.some((p) => matchesPrefix(pathname, p));
}

// 這個 API 路徑屬於哪個功能？取「最長」的前綴，沒對到就回 null（＝不受開關管制）
export function featureKeyForApi(pathname) {
  let best = null;
  let bestLen = 0;
  for (const feature of FEATURE_CATALOG) {
    for (const prefix of feature.apis || []) {
      if (matchesPrefix(pathname, prefix) && prefix.length > bestLen) {
        best = feature.key;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}
