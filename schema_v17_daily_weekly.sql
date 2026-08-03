-- ============================================================
-- 追加：每日自評 + 每週目標確認
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

-- 每日自評（下班前填，5題簡答）
create table daily_reflections (
  id               uuid primary key default gen_random_uuid(),
  staff_id         uuid references staff(id),
  branch_id        uuid references branches(id),
  work_date        date not null,
  completed_tasks  text,   -- 今天完成了哪些工作？
  best_task        text,   -- 今天哪一項工作做得最好？
  problems         text,   -- 今天遇到什麼問題？
  needs_help       text,   -- 今天有什麼需要協助？
  improve_tomorrow text,   -- 明天需要改善什麼？
  submitted_at     timestamptz default now(),
  unique (staff_id, work_date)
);

-- 每週目標確認（同仁跟主管一起對，一週一筆）
create table weekly_goals (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid references staff(id),
  branch_id           uuid references branches(id),
  week_start          date not null,   -- 該週星期一的日期
  main_goals          text,   -- 本週主要工作目標
  quality_requirements text,  -- 品質要求
  completed_items     text,   -- 已完成事項
  pending_items       text,   -- 尚未完成事項
  needs_help          text,   -- 需要協助事項
  next_week_focus     text,   -- 下週改善重點
  status              text default 'draft',  -- draft / confirmed（雙方對過）
  confirmed_by         uuid references staff(id),  -- 主管確認人
  confirmed_at         timestamptz,
  updated_at          timestamptz default now(),
  unique (staff_id, week_start)
);
