// ============================================================
// API 單一入口（取代 Railway 版的 Express 路由）
//
// 網頁上的 fetch('/api/...') 會被轉接器（shim.js）改送到這裡的 api()，
// 這裡依「方法＋路徑」找到對應的函式執行，回傳 { status, body }，
// 網頁端拿到的結果跟原本 fetch 的回應長得一樣。
//
// 每個請求的處理順序：
//   1. 找路由（找不到 → 404）
//   2. 功能開關把關（功能被關掉 → 403），規則同 Railway 版 featureGuard
//   3. 驗證登入憑證（public 的路由除外，憑證無效 → 401）
//   4. 執行對應函式
// ============================================================

function routes_() {
  return [
    { method: 'GET', path: '/api/health', handler: apiHealth_, public: true },
    { method: 'POST', path: '/api/login', handler: apiLogin_, public: true },

    { method: 'GET', path: '/api/staff/list', handler: apiStaffList_ },
    { method: 'GET', path: '/api/staff/password-status', handler: apiPasswordStatus_ },
    { method: 'GET', path: '/api/schedule/today', handler: apiScheduleToday_ },
    { method: 'GET', path: '/api/schedule/team-lead-today', handler: apiTeamLeadToday_ },

    { method: 'GET', path: '/api/features', handler: apiFeatures_ },
    { method: 'GET', path: '/api/features/state', handler: apiFeatureState_ },
    { method: 'POST', path: '/api/features/bulk', handler: apiFeaturesBulk_ },
    { method: 'POST', path: '/api/features/preset/:name', handler: apiFeaturesPreset_ },
    { method: 'PUT', path: '/api/features/:key', handler: apiFeatureUpdate_ },

    { method: 'GET', path: '/api/accounts/meta', handler: apiAccountsMeta_ },
    { method: 'GET', path: '/api/accounts', handler: apiAccountsList_ },
    { method: 'POST', path: '/api/accounts', handler: apiAccountsCreate_ },
    { method: 'PUT', path: '/api/accounts/:id', handler: apiAccountsUpdate_ },
    { method: 'POST', path: '/api/accounts/:id/password', handler: apiAccountsPassword_ },
    { method: 'POST', path: '/api/accounts/:id/reset-password', handler: apiAccountsResetPassword_ },
    { method: 'POST', path: '/api/accounts/:id/deactivate', handler: apiAccountsDeactivate_ },
    { method: 'POST', path: '/api/accounts/:id/activate', handler: apiAccountsActivate_ },
    { method: 'DELETE', path: '/api/accounts/:id', handler: apiAccountsDelete_ },

    { method: 'GET', path: '/api/self-eval/schedule', handler: apiSelfEvalSchedule_ },
    { method: 'GET', path: '/api/self-eval/templates', handler: apiSelfEvalTemplates_ },
    { method: 'POST', path: '/api/self-eval/templates', handler: apiSelfEvalTemplateCreate_ },
    { method: 'PUT', path: '/api/self-eval/templates/:id', handler: apiSelfEvalTemplateUpdate_ },
    { method: 'POST', path: '/api/self-eval/templates/:id/toggle', handler: apiSelfEvalTemplateToggle_ },
    { method: 'GET', path: '/api/self-eval/form', handler: apiSelfEvalForm_ },
    { method: 'POST', path: '/api/self-eval/save', handler: apiSelfEvalSave_ },
    { method: 'GET', path: '/api/self-eval/branch-overview', handler: apiSelfEvalBranchOverview_ },
    { method: 'GET', path: '/api/self-eval/submission-detail', handler: apiSelfEvalSubmissionDetail_ },
    { method: 'POST', path: '/api/self-eval/manager-review', handler: apiSelfEvalManagerReview_ },
    { method: 'GET', path: '/api/self-eval/hq-progress', handler: apiSelfEvalHqProgress_ },
  ];
}

function httpError_(status, message, extra) {
  const err = new Error(message);
  err.status = status;
  err.extra = extra || null;
  return err;
}

// '/api/accounts/:id/password' 對 '/api/accounts/abc/password' → { id: 'abc' }；對不上回傳 null
function matchPath_(pattern, path) {
  const a = pattern.split('/');
  const b = path.split('/');
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].charAt(0) === ':') params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

function api(reqText) {
  const started = Date.now();
  let req;
  try {
    req = JSON.parse(reqText);
  } catch (e) {
    return JSON.stringify({ status: 400, body: { error: '請求格式錯誤' } });
  }
  let result;
  try {
    result = { status: 200, body: dispatch_(req) };
  } catch (err) {
    if (err.status) {
      result = { status: err.status, body: Object.assign({ error: err.message }, err.extra || {}) };
    } else {
      console.error('[api] ' + req.method + ' ' + req.path + ' 發生錯誤：' + (err.stack || err.message));
      result = { status: 500, body: { error: '系統發生錯誤：' + err.message } };
    }
  }
  // 花費時間（測試站右下角會顯示）
  result.ms = Date.now() - started;
  result.stats = DB_STATS_;
  return JSON.stringify(result);
}

function dispatch_(req) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '').replace(/\/+$/, '') || '/';

  let route = null;
  let params = null;
  let pathExists = false;
  const all = routes_();
  for (let i = 0; i < all.length; i++) {
    const p = matchPath_(all[i].path, path);
    if (!p) continue;
    pathExists = true;
    if (all[i].method === method) { route = all[i]; params = p; break; }
  }
  if (!route) {
    // 路徑屬於還沒搬過來的功能：照功能開關的格式回 403，網頁會當作「功能已關閉」處理
    guardFeature_(path);
    throw httpError_(pathExists ? 405 : 404, '找不到這個 API：' + method + ' ' + path);
  }

  guardFeature_(path);
  const actor = route.public ? null : authenticate_(req.token);

  return route.handler({
    method: method,
    path: path,
    params: params,
    query: req.query || {},
    body: req.body || {},
    actor: actor,
  });
}

// GET /api/health
function apiHealth_() {
  return {
    status: 'ok',
    service: 'norden-daily-ops-gas',
    db_name: getDb_().getName(),
    env: isStaging_() ? 'staging' : 'production',
    build: BUILD_INFO,
  };
}
