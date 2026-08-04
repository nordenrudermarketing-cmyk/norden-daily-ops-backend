-- ============================================================
-- 清除測試資料（第二版：改用姓名比對，因為測試帳號的登入代碼也用了純數字）
-- 判斷邏輯：姓名包含「測試」或「test」的帳號視為測試帳號
--
-- 執行前建議：先單獨執行這句確認清單，你已經確認過這6筆都是測試帳號：
--   select id, name, login_code from staff where name ilike '%測試%' or name ilike '%test%';
--
-- 請到 Supabase SQL Editor 執行
-- ============================================================

create temporary table _test_staff_ids as
select id from staff where name ilike '%測試%' or name ilike '%test%';

delete from self_eval_submissions where staff_id in (select id from _test_staff_ids);
delete from daily_reflections where staff_id in (select id from _test_staff_ids);
delete from weekly_goals where staff_id in (select id from _test_staff_ids) or confirmed_by in (select id from _test_staff_ids);
delete from staff_learning_progress where staff_id in (select id from _test_staff_ids);
delete from practical_exams where staff_id in (select id from _test_staff_ids);
delete from assessment_stage_evaluations where staff_id in (select id from _test_staff_ids);
delete from daily_bonus_summary where staff_id in (select id from _test_staff_ids);
delete from defect_logs where reported_by in (select id from _test_staff_ids);
delete from anomaly_logs where related_staff_id in (select id from _test_staff_ids);
delete from manager_task_completions where staff_id in (select id from _test_staff_ids);
delete from shift_task_completions where staff_id in (select id from _test_staff_ids);
delete from deep_clean_assignments where owner_staff_id in (select id from _test_staff_ids) or checked_by in (select id from _test_staff_ids);
delete from room_maintenance_completions where completed_by in (select id from _test_staff_ids) or checked_by in (select id from _test_staff_ids);
delete from paint_inspections where updated_by in (select id from _test_staff_ids);
delete from public_area_maintenance_completions where completed_by in (select id from _test_staff_ids) or assigned_to in (select id from _test_staff_ids);
delete from zone_owners where staff_id in (select id from _test_staff_ids);
delete from floor_owners where staff_id in (select id from _test_staff_ids);
delete from daily_team_leads where staff_id in (select id from _test_staff_ids);
delete from staff_schedule where staff_id in (select id from _test_staff_ids);
delete from shift_handover_reports where submitted_by in (select id from _test_staff_ids);
update hq_tasks set completed_by = null where completed_by in (select id from _test_staff_ids);
delete from room_cleanings where cleaned_by in (select id from _test_staff_ids) or checked_by in (select id from _test_staff_ids);

delete from staff where id in (select id from _test_staff_ids);

drop table _test_staff_ids;
