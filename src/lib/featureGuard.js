// ============================================================
// 功能開關的後端把關
//
// 掛在所有 /api 之前：功能被總公司關掉的話，對應的 API 直接回 403，
// 這樣就算有人記得舊網址、或直接打 API，也一樣用不了。
//
// 沒有對應到任何功能的路徑（登入、同仁清單、健康檢查…）一律放行。
// ============================================================

import { featureKeyForApi, isAlwaysOpen, getFeature } from './featureCatalog.js';
import { isFeatureEnabled } from './featureState.js';

export async function featureGuard(req, res, next) {
  try {
    const pathname = req.baseUrl ? req.baseUrl + req.path : req.path;

    if (isAlwaysOpen(pathname)) return next();

    const key = featureKeyForApi(pathname);
    if (!key) return next();

    if (await isFeatureEnabled(key)) return next();

    const feature = getFeature(key);
    return res.status(403).json({
      error: `「${feature?.label || key}」目前已由總公司關閉`,
      feature_disabled: true,
      feature_key: key,
    });
  } catch (err) {
    // 把關本身出錯就放行，不要讓開關系統變成單點故障
    console.warn('[features] featureGuard 發生錯誤，先放行：', err.message);
    next();
  }
}
