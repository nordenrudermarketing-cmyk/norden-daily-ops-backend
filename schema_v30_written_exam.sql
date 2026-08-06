-- ============================================================
-- 追加：櫃檯（客務）加給考核筆試 — 題庫 + 考核紀錄
-- 台中館、台東2館共用同一份題庫（依你說的「一館和二館都適用」）
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v30_seed.sql
-- ============================================================

create table written_exam_questions (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id),
  section         text not null,   -- 是非題 / 選擇題 / 問答題
  question_number int not null,
  question_text   text not null,
  options_text    text,            -- 選擇題的 A/B/C/D 選項（合併成一段文字），是非/問答題留空
  sort_order      int default 0
);

create table written_exam_results (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid references staff(id),
  branch_id    uuid references branches(id),
  exam_date    date not null,
  score        numeric,
  passed       boolean,
  examiner     text,
  notes        text,
  created_at   timestamptz default now()
);
