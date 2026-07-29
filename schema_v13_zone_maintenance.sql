-- ============================================================
-- 追加：台東1館 A-E 責任區保養排程（房號級，週循環）
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v13_seed.sql
-- ============================================================

-- 責任區負責人（暫不輪替，經理直接指定，類似 floor_owners 但用 zone 文字取代樓層數字）
create table zone_owners (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id),
  zone         text not null,      -- A / B / C / D / E
  staff_id     uuid references staff(id),
  period_start date not null,
  period_end   date,
  unique (branch_id, zone, period_start)
);

-- 保養任務範本（房號級：所有責任區共用同一套項目，只是套用到不同房間）
-- cycle: week1 / week2 / week3 / week4 / monthly / quarterly
-- quarter_group：只有 cycle='quarterly' 才用得到，1=(1,4,7,10月) 2=(2,5,8,11月) 3=(3,6,9,12月)
create table room_maintenance_templates (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id),
  cycle          text not null,
  quarter_group  int,
  task_name      text not null,
  sort_order     int default 0
);

-- 每間房、每個任務、每個月的完成紀錄
create table room_maintenance_completions (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid references room_maintenance_templates(id),
  room_id        uuid references rooms(id),
  month          date not null,   -- 該月第一天
  status         text default 'pending',
  completed_date date,
  completed_by   uuid references staff(id),
  checked_by     uuid references staff(id),
  checked_at     timestamptz,
  notes          text,
  unique (template_id, room_id, month)
);
create index idx_room_maint_branch_month on room_maintenance_completions(month);

-- 油漆巡視狀態（持續性狀態，不是每月重來，客務/房務發現變化時更新）
create table paint_inspections (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references rooms(id) unique,
  status       text default 'clean',  -- clean / needs_paint / wall_disease
  note         text,
  updated_by   uuid references staff(id),
  updated_at   timestamptz default now()
);
