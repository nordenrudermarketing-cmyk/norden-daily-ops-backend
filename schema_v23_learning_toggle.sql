-- ============================================================
-- 追加：學習地圖改成「店經理開啟才有」，不是每個人都自動有
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

alter table staff add column if not exists learning_map_enabled boolean default false;
