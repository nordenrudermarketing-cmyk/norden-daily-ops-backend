-- ============================================================
-- 追加：每月工作夥伴自檢表（自評）
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v16_seed.sql
-- ============================================================

-- 題目範本（category: common 全部門共同 / management 主管職 / housekeeping 房務 / frontdesk 客務）
create table self_eval_templates (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  question_zh  text not null,
  question_id  text,        -- 印尼文翻譯（房務部分有，其餘可留空）
  sort_order   int default 0,
  is_active    boolean default true
);

-- 每人每月一份自評表
create table self_eval_submissions (
  id                     uuid primary key default gen_random_uuid(),
  staff_id               uuid references staff(id),
  branch_id              uuid references branches(id),
  eval_month             date not null,   -- 被評核的月份第一天（例如8月填7月的表，存 2026-07-01）
  status                 text default 'draft',  -- draft / submitted / reviewed
  due_date               date,            -- 當月10號
  submitted_at           timestamptz,
  manager_interview_notes text,
  interview_date         date,
  manager_signed_at      timestamptz,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  unique (staff_id, eval_month)
);

-- 每一題的作答（人員自檢 + 主管確認）
create table self_eval_answers (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid references self_eval_submissions(id) on delete cascade,
  template_id    uuid references self_eval_templates(id),
  staff_answer   text,   -- yes / no
  staff_note     text,
  manager_answer text,   -- yes / no
  manager_note   text,
  unique (submission_id, template_id)
);
