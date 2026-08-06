-- ============================================================
-- 追加：店經理發起「全房臨時任務」，小隊長分配給誰、大家都看得到、任何人可代做
-- 例如：全館貼門上貼紙、全館檢查某個設備
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

create table adhoc_tasks (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id),
  title        text not null,
  description  text,
  due_date     date,
  created_by   uuid references staff(id),
  created_at   timestamptz default now()
);

create table adhoc_task_assignments (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid references adhoc_tasks(id) on delete cascade,
  room_id        uuid references rooms(id),
  assigned_to    uuid references staff(id),
  status         text default 'pending',  -- pending / completed
  completed_by   uuid references staff(id),
  completed_at   timestamptz,
  unique (task_id, room_id)
);
