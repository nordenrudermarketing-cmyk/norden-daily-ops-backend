-- ============================================================
-- 追加：公區保養任務加入「小隊長分配」欄位
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

alter table public_area_maintenance_completions add column if not exists assigned_to uuid references staff(id);
