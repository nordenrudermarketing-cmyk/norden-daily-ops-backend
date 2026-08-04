-- ============================================================
-- 追加：學習地圖改成「指派制」
-- 店經理指派「誰要學」＋「哪個項目由誰教」，教練用自己帳號完成教學任務，
-- 新人用自己帳號查看（唯讀）自己的學習進度
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

create table learning_unit_assignments (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid references learning_units(id) on delete cascade,
  trainee_id    uuid references staff(id),
  trainer_id    uuid references staff(id),
  assigned_by   uuid references staff(id),
  assigned_at   timestamptz default now(),
  status        text default 'pending',  -- pending / completed
  completed_at  timestamptz,
  unique (unit_id, trainee_id)
);
create index idx_lua_trainer on learning_unit_assignments(trainer_id, status);
create index idx_lua_trainee on learning_unit_assignments(trainee_id);
