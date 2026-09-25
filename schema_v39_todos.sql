-- ============================================================
-- 追加：待辦事項追蹤（取代舊的「總公司交辦任務」hq_tasks）
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
--
-- 要跑兩次：
--   進測試區：最前面加一行  set search_path to staging, public;  再執行
--   進正式區：把那一行刪掉再執行一次
--
-- 副理（含）以上可以派任務給別人，執行人更新進度、按「完成待檢查」，
-- 派發這一方再按「檢核結案」。
--
-- 舊的 hq_tasks 資料表保留不刪（舊資料不搬過來），萬一要退回舊版程式也不會壞。
-- 新表只有新程式會用，所以上線順序是：先跑這份 SQL → 再 merge 程式碼。
-- ============================================================

create table if not exists todo_tasks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  due_date         date,                                  -- 預計完成日（選填）
  -- in_progress 執行中 / pending_review 完成待檢查 / on_hold 暫緩執行 / done 已結案
  status           text not null default 'in_progress',
  -- 派發方的館別：決定「我派發的任務」誰看得到
  -- （總公司帳號都屬於「總公司」這個館別，所以總公司看得到所有總公司帳號派的任務）
  owner_branch_id  uuid references branches(id),
  created_by       uuid references staff(id),
  assignee_id      uuid references staff(id),
  submitted_at     timestamptz,                           -- 執行人按「完成待檢查」的時間
  closed_at        timestamptz,                           -- 上級按「檢核結案」的時間
  closed_by        uuid references staff(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_todo_tasks_owner    on todo_tasks(owner_branch_id, status);
create index if not exists idx_todo_tasks_assignee on todo_tasks(assignee_id, status);

-- 進度紀錄：同仁手動填的進度，以及狀態變更時系統自動記的一筆
create table if not exists todo_task_updates (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references todo_tasks(id) on delete cascade,
  update_date  date not null,
  note         text not null,
  -- progress 進度 / assign 更換執行人 / hold 暫緩 / resume 恢復執行
  -- submit 完成待檢查 / close 檢核結案 / reject 退回
  kind         text not null default 'progress',
  created_by   uuid references staff(id),
  created_at   timestamptz default now()
);

create index if not exists idx_todo_task_updates_task on todo_task_updates(task_id, created_at);

-- ------------------------------------------------------------
-- （選用，只在正式區考慮）功能開關的規則是「資料表裡沒有的功能一律當作開啟」，
-- 所以程式 merge 之後，待辦事項會直接在正式站打開。
-- 如果正式站還要維持「只開放自評表」，正式區執行時把下面這行前面的 -- 拿掉：
-- insert into feature_toggles (feature_key, enabled) values ('todos', false) on conflict (feature_key) do nothing;
-- ------------------------------------------------------------

-- 檢查：應該看到兩張表
select table_schema, table_name
from information_schema.tables
where table_name in ('todo_tasks', 'todo_task_updates')
order by table_schema, table_name;
