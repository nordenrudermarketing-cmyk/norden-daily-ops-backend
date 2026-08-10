-- ============================================================
-- 追加：① 選擇題正確答案 ② 線上限時測驗（自動計分）
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v36_seed.sql
-- ============================================================

alter table written_exam_questions add column if not exists correct_answer text;   -- 選擇題正確答案（單一字母），是非/問答題留空
alter table written_exam_questions add column if not exists reference_answer text; -- 問答題參考答案，只給經理審閱時看，不會顯示給作答者

create table written_exam_attempts (
  id                uuid primary key default gen_random_uuid(),
  staff_id          uuid references staff(id),
  branch_id         uuid references branches(id),
  time_limit_minutes int default 40,
  started_at        timestamptz default now(),
  submitted_at      timestamptz,
  correct_count     int,
  wrong_count       int,
  total_scored      int,   -- 有標準答案、算進自動計分的題目總數
  passed            boolean,
  status            text default 'in_progress'  -- in_progress / submitted
);

create table written_exam_answers (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid references written_exam_attempts(id) on delete cascade,
  question_id  uuid references written_exam_questions(id),
  answer_text  text,
  is_correct   boolean   -- 只有選擇題（有 correct_answer）才會判斷，其餘留空
);
