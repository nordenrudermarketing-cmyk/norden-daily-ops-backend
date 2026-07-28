-- ============================================================
-- 追加：① 簡化房務職務（拿掉小隊長／樓主獨立職務）② 總公司模組
-- 請到 Supabase SQL Editor 依序執行
-- ============================================================

-- ------------------------------------------------------------
-- ① 職務簡化：房務小隊長／房務樓主 統一併回「房務人員」
--    （小隊長是每天輪值、樓主是 floor_owners 表已經在追蹤的資料，
--     職務欄位不需要重複標記，任何房務同仁都能操作房號分配／細清排程）
-- ------------------------------------------------------------
update staff
set role_id = (select id from roles where name = '房務人員')
where role_id in (select id from roles where name in ('房務小隊長', '房務樓主'));

delete from roles where name in ('房務小隊長', '房務樓主');

-- ------------------------------------------------------------
-- ② 總公司模組
-- ------------------------------------------------------------

-- 總公司本身視為一個特殊「館別」，方便沿用既有的 staff.branch_id 結構
insert into branches (name, code)
select '總公司', 'HQ'
where not exists (select 1 from branches where code = 'HQ');

-- 總公司職務
insert into roles (name, category)
select '總公司', 'headquarters'
where not exists (select 1 from roles where name = '總公司');

-- 總公司交辦任務（分派給特定館別，館別端可標記完成並留言回報）
create table hq_tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  target_branch_id  uuid references branches(id),
  assigned_by       text,        -- 總公司哪位同仁交辦（文字存，不強制對應帳號）
  due_date          date,
  status            text default 'pending',  -- pending / completed
  response_notes    text,
  completed_by      uuid references staff(id),
  completed_at      timestamptz,
  created_at        timestamptz default now()
);

create index idx_hq_tasks_branch on hq_tasks(target_branch_id, status);
