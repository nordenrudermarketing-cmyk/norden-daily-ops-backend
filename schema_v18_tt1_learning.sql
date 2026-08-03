-- ============================================================
-- 追加：① 學習項目支援印尼文翻譯 ② 台東1館學習地圖（房務＋客務）
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v18_seed.sql
-- ============================================================

alter table learning_units add column if not exists item_name_id text;

insert into learning_paths (branch_id, category, name)
select id, 'housekeeping', '房務新人訓練' from branches where code = 'TT1'
union all
select id, 'frontdesk', '客務新人訓練' from branches where code = 'TT1';
