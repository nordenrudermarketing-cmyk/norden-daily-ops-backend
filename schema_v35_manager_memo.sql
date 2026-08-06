-- ============================================================
-- 追加：店經理收班改成「工作備忘清單」（條列式，持續累積，不是每日重來）
-- 請到 Supabase SQL Editor 執行（不影響現有資料，manager_shift_reports 的開班
-- 欄位維持不變，只是不再使用收班那四個固定欄位）
-- ============================================================

create table manager_memo_items (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id),
  staff_id     uuid references staff(id),
  content      text not null,
  status       text default 'todo',  -- todo / in_progress / done
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  resolved_at  timestamptz
);
create index idx_memo_branch_status on manager_memo_items(branch_id, status);
