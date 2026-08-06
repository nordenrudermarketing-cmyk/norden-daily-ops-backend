-- ============================================================
-- 追加：教學指派加入「期限」欄位
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

alter table learning_unit_assignments add column if not exists due_date date;
