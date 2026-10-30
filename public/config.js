// 部署後，把 API_BASE_URL 留空字串即可（前端跟後端是同一個網域）。
// 只有在你把網頁另外放到別的地方時，才需要填完整網址，例如：
// window.APP_CONFIG = { API_BASE_URL: "https://astonishing-unity.up.railway.app" };
window.APP_CONFIG = { API_BASE_URL: "" };

// 帳號層級（權限的唯一依據，規則見 gas/Levels.gs）：field 現場人員／manager 經理／hq_admin 總公司行政／office 總辦公室
// 舊的登入資料沒有 account_level 時，用職務名稱推算（sidebar.js 會再跟伺服器要正確的值補上）
window.accountLevelOf = function (staff) {
  if (staff && staff.account_level) return staff.account_level;
  const roleName = staff?.roles?.name || '';
  if (roleName === '總公司' || roleName === '總辦公室經理') return 'office';
  if (roleName === '店經理' || roleName === '經理') return 'manager';
  return 'field';
};
window.LEVEL_LABELS = { field: '現場人員', manager: '經理', hq_admin: '總公司行政', office: '總辦公室' };
