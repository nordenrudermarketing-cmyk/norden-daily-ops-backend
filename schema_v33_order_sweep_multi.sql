-- ============================================================
-- 追加：掃單記錄改成「一天可以多筆」，不是每天只能存一筆
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

alter table order_sweep_logs drop constraint if exists order_sweep_logs_branch_id_work_date_key;
