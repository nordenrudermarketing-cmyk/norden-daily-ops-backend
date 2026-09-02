-- ============================================================
-- 追加：功能開關（總公司後台可以整組隱藏／開啟功能）
-- 請到 Supabase SQL Editor 執行（不影響任何現有資料）
--
-- 只存「哪個功能被關掉」，功能的名稱、包含哪些網頁與 API
-- 都寫在程式碼的 src/lib/featureCatalog.js，之後加新功能不用改資料庫。
-- 這張表沒有的功能一律視為「開啟」。
-- ============================================================

create table if not exists feature_toggles (
  feature_key text primary key,
  enabled     boolean not null default true,
  updated_at  timestamptz default now(),
  updated_by  text
);

-- 預設全部開啟，跟目前行為完全一致（要關的話到「功能開關」後台按開關即可）
insert into feature_toggles (feature_key, enabled) values
  ('housekeeping_cleaning', true),
  ('deep_clean',            true),
  ('zone_maintenance',      true),
  ('public_area',           true),
  ('staff_cleaning',        true),
  ('frontdesk_shift',       true),
  ('handover',              true),
  ('daily_logs',            true),
  ('review_check',          true),
  ('routine_tasks',         true),
  ('shift_templates',       true),
  ('training',              true),
  ('written_exam',          true),
  ('bonus_appeals',         true),
  ('adhoc_tasks',           true),
  ('reflections',           true),
  ('manager_dashboard',     true),
  ('schedule',              true),
  ('issues',                true),
  ('manager_checklist',     true),
  ('manager_reports',       true),
  ('weekly_report',         true)
on conflict (feature_key) do nothing;

-- 自評表（self_eval）與系統後台（system_admin）是程式碼裡鎖定的保留項目，
-- 不會出現在這張表，也永遠關不掉。

-- ------------------------------------------------------------
-- 想直接用 SQL 切成「只開放自評表」的話（等同後台按下那顆按鈕）：
--
--   update feature_toggles set enabled = false, updated_at = now();
--
-- 想全部開回來：
--
--   update feature_toggles set enabled = true, updated_at = now();
-- ------------------------------------------------------------
