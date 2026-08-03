-- ============================================================
-- 追加：① NO SHOW記錄 ② 評論回報 ③ 例行事項總表 ④ 經理開班/收班日報
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

-- ① NO SHOW 記錄
create table no_show_records (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id),
  work_date     date not null,
  guest_info    text not null,   -- 訂單/客人資訊
  room_type     text,
  charged       boolean default false,  -- 有沒有收費
  amount        numeric,
  note          text,
  reported_by   uuid references staff(id),
  created_at    timestamptz default now()
);
create index idx_noshow_branch_date on no_show_records(branch_id, work_date);

-- ② 評論回報（四平台固定巡查）
create table review_checks (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id),
  work_date     date not null,
  platform      text not null,  -- BK / AG / Ctrip / Google
  status        text default 'pending',
  checked_by    uuid references staff(id),
  checked_at    timestamptz,
  note          text,           -- 發現故障/客訴類評論時填
  unique (branch_id, work_date, platform)
);

-- ③ 例行事項總表（持續存在，不是每日/每月重新產生）
create table routine_tasks (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id),
  category       text not null,  -- 採購 / 銀行 / 總務
  item_name      text not null,
  week_note      text,           -- 週次說明
  progress_note  text,           -- 進度說明
  due_date       date,
  status         text default 'pending',  -- pending / in_progress / completed
  assigned_to    uuid references staff(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index idx_routine_branch on routine_tasks(branch_id, status);

-- ④ 經理開班/收班日報（敘述式，一天一份）
create table manager_shift_reports (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id),
  work_date       date not null,
  planned_tasks   text,   -- 開班：預計執行事項
  completed_items text,   -- 收班：完成事項
  pending_items   text,   -- 收班：未完成待追蹤
  spot_checks     text,   -- 收班：各項抽檢
  hq_notes        text,   -- 收班：總公司反應事項
  opened_by       uuid references staff(id),
  opened_at       timestamptz,
  closed_by       uuid references staff(id),
  closed_at       timestamptz,
  unique (branch_id, work_date)
);
