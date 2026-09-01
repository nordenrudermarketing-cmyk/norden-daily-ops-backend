import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// ============================================================
// 環境變數檢查
//
// 這三個值很容易在 Railway 的 Variables 裡貼錯格（尤其是新增測試 service 的時候），
// 所以這裡先擋一次，錯了就給明確訊息，不要等到 supabase-js 丟出看不懂的錯誤。
//
// ⚠ 檢查失敗時「絕對不印出實際的值」——貼錯格的時候那個值很可能就是金鑰本身，
//   印出來會直接留在 Railway 的日誌裡。
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DB_SCHEMA = process.env.SUPABASE_DB_SCHEMA || 'public';

if (!/^https?:\/\/\S+$/i.test(SUPABASE_URL)) {
  throw new Error(
    'SUPABASE_URL 不是有效的網址。它應該長得像 https://xxxxx.supabase.co\n' +
    '（Supabase → Settings → API → Project URL）。請檢查 Railway 的環境變數是不是貼錯格了。'
  );
}

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    '缺少 SUPABASE_SERVICE_ROLE_KEY。\n' +
    '（Supabase → Settings → API → service_role key）'
  );
}

// schema 名稱只會是英數和底線，長度也不會太長。
// 不符合就代表這一格被貼成別的東西了（最常見的就是不小心貼成金鑰）。
if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(DB_SCHEMA)) {
  throw new Error(
    'SUPABASE_DB_SCHEMA 的值看起來不是 schema 名稱。\n' +
    '它應該是 public（正式）或 staging（測試），就這幾個字而已。\n' +
    '請檢查 Railway 的環境變數是不是把金鑰貼到這一格了。'
  );
}

// 走到這裡代表 DB_SCHEMA 一定是單純的識別字，印出來是安全的
if (DB_SCHEMA !== 'public') {
  console.log(`[db] 使用測試 schema：${DB_SCHEMA}（不是正式資料）`);
}

// 後端一律用 service_role key，繞過 RLS，因為權限控制在 API 層自己做
export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: DB_SCHEMA },
});

// 注意：supabase.storage（缺失照片的 photos bucket）不受 schema 影響，
// 正式跟測試會共用同一個 bucket。測試上傳的照片會跟正式照片放在一起，
// 不影響功能，只是會多幾張用不到的圖。
export const CURRENT_DB_SCHEMA = DB_SCHEMA;
