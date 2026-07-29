-- ============================================================
-- 追加：簡化客務職務（拿掉 A/B/C 班獨立職務，統一併回「客務人員」）
-- 理由：跟房務小隊長／樓主一樣，沒有人是固定哪一班，是排班表每天決定的，
--       職務欄位不該綁死；系統的班別任務內容本來就已經是照排班表的
--       shift_code（A/B/C）走的，不需要靠職務名稱來判斷
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

insert into roles (name, category)
select '客務人員', 'frontdesk'
where not exists (select 1 from roles where name = '客務人員');

update staff
set role_id = (select id from roles where name = '客務人員')
where role_id in (select id from roles where name in ('客務A班', '客務B班', '客務C班'));

delete from roles where name in ('客務A班', '客務B班', '客務C班');
