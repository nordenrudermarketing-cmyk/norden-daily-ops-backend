-- ============================================================
-- 追加：台東1館 公區保養月曆（日常＋隊長任務＋週輪替＋月清＋季清＋雙月清）
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v14_seed.sql
-- ============================================================

-- cycle: daily_am / daily_pm / team_lead / weekly_odd（1、3週）/ weekly_even（2、4週）/
--        monthly / quarterly（配合 quarter_group）/ bimonthly_odd（奇數月）/ bimonthly_even（偶數月）
create table public_area_maintenance_templates (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id),
  cycle          text not null,
  quarter_group  int,
  task_name      text not null,
  sort_order     int default 0
);

-- period_key：daily 系列存日期字串 'YYYY-MM-DD'；monthly/quarterly/bimonthly 系列存月份字串 'YYYY-MM'
create table public_area_maintenance_completions (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid references public_area_maintenance_templates(id),
  branch_id      uuid references branches(id),
  period_key     text not null,
  status         text default 'pending',
  completed_by   uuid references staff(id),
  completed_at   timestamptz,
  notes          text,
  unique (template_id, period_key)
);
create index idx_pa_maint_branch on public_area_maintenance_completions(branch_id, period_key);
