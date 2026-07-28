-- ============================================================
-- 追加：店經理每日巡館清單
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

create table manager_task_templates (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id),
  task_name    text not null,
  requires_note boolean default true,
  sort_order   int default 0,
  is_active    boolean default true
);

create table manager_task_completions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references manager_task_templates(id),
  staff_id      uuid references staff(id),
  branch_id     uuid references branches(id),
  work_date     date not null,
  status        text default 'pending',
  notes         text,
  completed_at  timestamptz,
  unique (template_id, work_date)
);

create index idx_manager_task_date on manager_task_completions(branch_id, work_date);

-- Seed：依原始文件的店經理每日工作清單
insert into manager_task_templates (branch_id, task_name, requires_note, sort_order)
select id, t.task_name, true, t.sort_order
from branches, (values
  ('每日巡館', 1),
  ('今日及未來住房率確認', 2),
  ('人力配置確認', 3),
  ('客訴與旅客反饋', 4),
  ('設備維修案件', 5),
  ('房務及櫃檯品質抽查', 6),
  ('同仁教育與溝通', 7),
  ('異常事件回報', 8)
) as t(task_name, sort_order)
where branches.code = 'TC';
