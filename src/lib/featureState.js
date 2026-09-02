// ============================================================
// 功能開關的實際狀態（讀 feature_toggles 資料表 + 記憶體快取）
//
// 每一支 API 都會經過 featureGuard，所以不能每次都去查資料庫，
// 這裡用 10 秒的記憶體快取；總公司按下開關時會立刻清掉快取，
// 所以後台改完是馬上生效，不用等 10 秒。
//
// 查不到資料表（例如 schema_v37 還沒執行）或 Supabase 掛掉時一律「當作全開」，
// 寧可功能還在，也不要因為開關系統本身出問題就讓整個系統不能用。
// ============================================================

import { supabase } from '../supabaseClient.js';
import { FEATURE_CATALOG, FEATURE_KEYS, LOCKED_KEYS } from './featureCatalog.js';

const TABLE = 'feature_toggles';
const CACHE_TTL_MS = 10 * 1000;

let cache = null;        // { [key]: boolean }
let cacheAt = 0;
let tableMissing = false; // 資料表還沒建立過就不用一直重試查詢

function allEnabled() {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, true]));
}

export function invalidateFeatureCache() {
  cache = null;
  cacheAt = 0;
}

// 回傳 { [featureKey]: boolean }；catalog 有、資料表沒有的 key 一律視為開啟
export async function getFeatureState({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  if (tableMissing) return allEnabled();

  const { data, error } = await supabase.from(TABLE).select('feature_key, enabled');

  if (error) {
    // 42P01 = relation does not exist（SQL 還沒跑）
    if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
      tableMissing = true;
      console.warn(`[features] 找不到 ${TABLE} 資料表，功能開關暫時全開；請先執行 schema_v37_feature_toggles.sql`);
    } else {
      console.warn('[features] 讀取功能開關失敗，暫時全開：', error.message);
    }
    return allEnabled();
  }

  const state = allEnabled();
  for (const row of data || []) {
    if (row.feature_key in state) state[row.feature_key] = row.enabled !== false;
  }
  // 鎖定的功能永遠是開的，就算資料庫被手動改成 false 也一樣
  for (const key of LOCKED_KEYS) state[key] = true;

  cache = state;
  cacheAt = Date.now();
  return state;
}

export async function isFeatureEnabled(key) {
  if (!key) return true;
  const state = await getFeatureState();
  return state[key] !== false;
}

// 寫入一批開關值 { [key]: boolean }，鎖定的功能會被忽略
export async function setFeatureState(updates, updatedBy = null) {
  const rows = [];
  for (const [key, enabled] of Object.entries(updates)) {
    if (!FEATURE_KEYS.includes(key)) continue;
    if (LOCKED_KEYS.includes(key)) continue;
    rows.push({
      feature_key: key,
      enabled: !!enabled,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    });
  }
  if (rows.length === 0) return { updated: 0 };

  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'feature_key' });
  if (error) throw new Error(error.message);

  tableMissing = false;
  invalidateFeatureCache();
  return { updated: rows.length };
}

// 給前端用的完整清單：目錄資訊 + 目前開關狀態
export async function listFeatures() {
  const state = await getFeatureState();
  return FEATURE_CATALOG.map((f) => ({
    key: f.key,
    label: f.label,
    group: f.group,
    description: f.description || '',
    locked: !!f.locked,
    pages: f.pages || [],
    enabled: state[f.key] !== false,
  }));
}
