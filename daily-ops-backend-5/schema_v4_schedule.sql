-- ============================================================
-- 追加：排班表模組
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

-- 每位同仁每天的實際班別（取代「職務=固定班別」的假設）
create table staff_schedule (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references staff(id) on delete cascade,
  branch_id   uuid references branches(id),
  work_date   date not null,
  shift_code  text not null,   -- A / B / C / 房 / 中 / 昼 / 特 / 1（休）/ PT1 / PT2 / 管 等
  unique (staff_id, work_date)
);
create index idx_schedule_branch_date on staff_schedule(branch_id, work_date);

-- 禁休日標記（固定週六 + 主管每月自訂的特殊日期）
create table schedule_blackout_dates (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references branches(id),
  date        date not null,
  note        text,
  unique (branch_id, date)
);

-- 每月排班規則設定（休假天數目標、每日最低上班人數）
create table schedule_settings (
  id                        uuid primary key default gen_random_uuid(),
  branch_id                 uuid references branches(id),
  month                     date not null,  -- 該月第一天
  target_off_days           int default 11,
  min_staff_frontdesk       int default 3,
  min_staff_housekeeping    int default 3,
  unique (branch_id, month)
);

-- 讓客務班別任務範本可以停用（軟刪除），不會動到既有的回報/完成紀錄
alter table shift_task_templates add column if not exists is_active boolean default true;
