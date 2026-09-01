import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// 要用資料庫裡的哪一個 schema。
// 不設定 = public = 正式資料，行為跟以前完全一樣。
// 測試用的 Railway service 設 SUPABASE_DB_SCHEMA=staging，就會整組切到測試資料，
// 兩邊共用同一個 Supabase 專案、同一組金鑰，但資料完全分開。
const DB_SCHEMA = process.env.SUPABASE_DB_SCHEMA || 'public';

if (DB_SCHEMA !== 'public') {
  console.log(`[db] 使用測試 schema：${DB_SCHEMA}（不是正式資料）`);
}

// 後端一律用 service_role key，繞過 RLS，因為權限控制在 API 層自己做
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: DB_SCHEMA } }
);

// 注意：supabase.storage（缺失照片的 photos bucket）不受 schema 影響，
// 正式跟測試會共用同一個 bucket。測試上傳的照片會跟正式照片放在一起，
// 不影響功能，只是會多幾張用不到的圖。
export const CURRENT_DB_SCHEMA = DB_SCHEMA;
