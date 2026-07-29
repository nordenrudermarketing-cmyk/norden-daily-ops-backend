-- ============================================================
-- 追加：客務班別任務支援「排班型態」（ABC 正常班 / AABB 沒排C班）
--      並建入台東1館的完整任務內容（兩種型態各自的真實清單）
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v11_seed.sql
-- ============================================================

alter table shift_task_templates add column if not exists schedule_pattern text default 'ABC';
