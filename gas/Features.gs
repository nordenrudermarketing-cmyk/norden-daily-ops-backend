// ============================================================
// 功能開關（規則同 Railway 版 featureState.js / featureGuard.js / routes/features.js）
//
// feature_toggles 分頁只記「哪個功能被關掉」，沒有那一列的功能視為開啟。
// 每個 API 都會檢查開關，所以狀態放在 CacheService 快取 10 秒；總公司按下開關時立刻清掉快取。
// 讀取失敗時一律當作全開——寧可功能還在，也不要因為開關本身出問題讓整個系統不能用。
// 例外：還沒搬到 Apps Script 的功能（Catalog.gs 沒標 ported）一律關閉。
// ============================================================

const FEATURE_CACHE_KEY = 'feature_state_v1';

function featureByKey_(key) {
  return FEATURE_CATALOG.find(function (f) { return f.key === key; }) || null;
}

// 用「整段」比對，避免 /api/bonus 誤中 /api/bonus-appeals
function matchesPrefix_(path, prefix) {
  return path === prefix || path.indexOf(prefix + '/') === 0;
}

function isAlwaysOpen_(path) {
  return ALWAYS_OPEN_APIS.some(function (p) { return matchesPrefix_(path, p); });
}

// 這個 API 屬於哪個功能？取最長的前綴，沒對到回傳 null（不受開關管制）
function featureKeyForApi_(path) {
  let best = null;
  let bestLen = 0;
  FEATURE_CATALOG.forEach(function (f) {
    (f.apis || []).forEach(function (prefix) {
      if (matchesPrefix_(path, prefix) && prefix.length > bestLen) {
        best = f.key;
        bestLen = prefix.length;
      }
    });
  });
  return best;
}

// 回傳 { [功能代碼]: true/false }
function getFeatureState_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(FEATURE_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const state = {};
  FEATURE_CATALOG.forEach(function (f) { state[f.key] = true; });
  try {
    Db.all('feature_toggles').forEach(function (row) {
      if (row.feature_key in state) state[row.feature_key] = row.enabled !== false;
    });
  } catch (e) {
    console.warn('[features] 讀取功能開關失敗，暫時全開：' + e.message);
    return applyFixedState_(state);
  }
  applyFixedState_(state);
  cache.put(FEATURE_CACHE_KEY, JSON.stringify(state), 10);
  return state;
}

function applyFixedState_(state) {
  FEATURE_CATALOG.forEach(function (f) {
    if (f.locked) state[f.key] = true;     // 保留項目永遠開著
    if (!f.ported) state[f.key] = false;   // 還沒搬過來的永遠關著
  });
  return state;
}

function guardFeature_(path) {
  if (isAlwaysOpen_(path)) return;
  const key = featureKeyForApi_(path);
  if (!key || getFeatureState_()[key] !== false) return;
  const feature = featureByKey_(key);
  const label = feature ? feature.label : key;
  const message = feature && !feature.ported
    ? '「' + label + '」還沒搬到新系統'
    : '「' + label + '」目前已由總公司關閉';
  throw httpError_(403, message, { feature_disabled: true, feature_key: key });
}

function setFeatureState_(updates, updatedBy) {
  const rows = [];
  Object.keys(updates).forEach(function (key) {
    const f = featureByKey_(key);
    if (!f || f.locked || !f.ported) return;
    rows.push({ feature_key: key, enabled: !!updates[key], updated_at: nowIso_(), updated_by: updatedBy || null });
  });
  if (rows.length) Db.upsert('feature_toggles', ['feature_key'], rows);
  CacheService.getScriptCache().remove(FEATURE_CACHE_KEY);
  return rows.length;
}

function listFeatures_() {
  const state = getFeatureState_();
  return FEATURE_CATALOG.map(function (f) {
    return {
      key: f.key,
      label: f.ported ? f.label : f.label + '（尚未搬到新系統）',
      group: f.group,
      description: f.description || '',
      locked: !!f.locked,
      pages: f.pages || [],
      enabled: state[f.key] !== false,
    };
  });
}

// 目前是「全開」「只開自評表」還是「自訂」
function featureMode_(features) {
  const switchable = features.filter(function (f) { return !f.locked; });
  if (switchable.every(function (f) { return f.enabled; })) return 'all';
  if (switchable.every(function (f) { return !f.enabled; })) return 'self_eval_only';
  return 'custom';
}

function featuresResponse_() {
  const features = listFeatures_();
  return { mode: featureMode_(features), features: features };
}

// ---------- API ----------

// GET /api/features：側邊選單、登入導頁、總公司後台都用這支
function apiFeatures_() {
  const features = listFeatures_();
  const disabled = features.filter(function (f) { return !f.enabled; });
  return {
    mode: featureMode_(features),
    features: features,
    disabled_pages: [].concat.apply([], disabled.map(function (f) { return f.pages; })),
    disabled_keys: disabled.map(function (f) { return f.key; }),
  };
}

// GET /api/features/state
function apiFeatureState_() {
  return getFeatureState_();
}

// PUT /api/features/:key  { enabled }（只有總公司）
function apiFeatureUpdate_(req) {
  requireLevel_(req.actor, ['hq'], '功能開關只有總公司可以設定');
  const f = featureByKey_(req.params.key);
  if (!f) throw httpError_(404, '沒有這個功能：' + req.params.key);
  if (f.locked) throw httpError_(400, '這個功能是系統保留項目，不能關閉');
  if (!f.ported) throw httpError_(400, '「' + f.label + '」還沒搬到新系統，目前不能打開');
  if (typeof req.body.enabled !== 'boolean') throw httpError_(400, 'enabled 必須是 true 或 false');
  setFeatureState_({ [f.key]: req.body.enabled }, req.actor.name);
  return featuresResponse_();
}

// POST /api/features/bulk  { updates: { key: boolean } }（只有總公司）
function apiFeaturesBulk_(req) {
  requireLevel_(req.actor, ['hq'], '功能開關只有總公司可以設定');
  const updates = req.body.updates;
  if (!updates || typeof updates !== 'object') throw httpError_(400, '缺少 updates');
  setFeatureState_(updates, req.actor.name);
  return featuresResponse_();
}

// POST /api/features/preset/:name（self-eval-only 全關／enable-all 全開，只有總公司）
function apiFeaturesPreset_(req) {
  requireLevel_(req.actor, ['hq'], '功能開關只有總公司可以設定');
  let enabled;
  if (req.params.name === 'self-eval-only') enabled = false;
  else if (req.params.name === 'enable-all') enabled = true;
  else throw httpError_(400, '不認得的預設值：' + req.params.name);

  const updates = {};
  FEATURE_CATALOG.forEach(function (f) { if (!f.locked) updates[f.key] = enabled; });
  setFeatureState_(updates, req.actor.name);
  return featuresResponse_();
}
