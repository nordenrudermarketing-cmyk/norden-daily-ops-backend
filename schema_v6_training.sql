-- ============================================================
-- 追加：新人教育訓練系統
-- 請到 Supabase SQL Editor 依序執行這份，再執行 schema_v6_training_seed.sql
-- ============================================================

-- 學習地圖（依職務分類：housekeeping 房務／frontdesk 客務）
create table learning_paths (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references branches(id),
  category    text not null,   -- housekeeping / frontdesk
  name        text not null
);

-- 學習項目（對應 Excel/PDF 裡的每一列訓練項目）
create table learning_units (
  id          uuid primary key default gen_random_uuid(),
  path_id     uuid references learning_paths(id) on delete cascade,
  topic       text,      -- 大主題（客務用，例如「1.路得品牌介紹」），房務沒有這層可以是 NULL
  category    text not null,  -- 分類（例如「浴室清潔」「認識旅安」）
  item_name   text not null,  -- 實際項目內容
  sort_order  int default 0,
  is_active   boolean default true
);

-- 每位同仁在每個學習項目的進度（對應 Excel 的：培訓員/教學日期/驗收合格/不合格）
create table staff_learning_progress (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid references staff(id) on delete cascade,
  unit_id       uuid references learning_units(id) on delete cascade,
  trainer_name  text,          -- 培訓員（用文字存，不一定是系統帳號）
  taught_date   date,
  result        text,          -- null=尚未驗收 / pass=合格 / fail=不合格
  updated_at    timestamptz default now(),
  unique (staff_id, unit_id)
);

-- 房務整房實作考核（對應房務訓練表最下方的考核說明）
create table practical_exams (
  id                uuid primary key default gen_random_uuid(),
  staff_id          uuid references staff(id),
  exam_type         text default '整房考核',
  room_breakdown    text,      -- 例如：四人房1、雙人房1、雙床房2、背包房2、4人背包房1(含外衛浴)
  time_limit_minutes int default 240,
  score             numeric,
  passed            boolean,
  assessed_by       text,
  assessed_at       timestamptz,
  notes             text
);

-- Seed：兩條學習地圖（房務／客務）
insert into learning_paths (branch_id, category, name)
select id, 'housekeeping', '房務新人訓練' from branches where code = 'TC'
union all
select id, 'frontdesk', '客務新人訓練' from branches where code = 'TC';
