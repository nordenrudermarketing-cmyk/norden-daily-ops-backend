-- ============================================================
-- 追加：同仁登入密碼制度
-- 現有同仁的 password_hash 都是空的，第一次登入時系統會引導設定密碼
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

alter table staff add column if not exists password_hash text;
