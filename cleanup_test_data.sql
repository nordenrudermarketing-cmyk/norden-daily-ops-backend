-- ============================================================
-- 清除測試資料
-- 判斷邏輯：真實員工帳號的登入代碼都是純數字（員工編號），
--          任何登入代碼「不是」純數字的帳號，視為測試帳號，連同它產生過的
--          測試資料（打卡紀錄、獎金試算、缺失回報...等）一併清除。
--
-- 執行前建議：先把下面這句單獨執行一次，看看列出來的名字是不是你認得的測試帳號，
-- 確認沒有誤殺真人之後，再往下執行整份清除。
--
--   select id, name, login_code from staff where login_code !~ '^[0-9]+$';
--
-- 請到 Supabase SQL Editor 執行
-- ============================================================

-- 先建立一個暫存的測試帳號 id 清單，方便下面重複使用
create temporary table _test_staff_ids as
select id from staff where login_code !~ '^[0-9]+$';

-- 依關聯順序，先刪子表資料，最後才刪 staff 本身
delete from self_eval_submissions where staff_id in (select id from _test_staff_ids); -- 底下的 self_eval_answers 會自動連帶刪除
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
update hq_tasks set completed_by = null where completed_by in (select id from _test_staff_ids); -- 任務本身保留，只清掉測試人員的完成紀錄
delete from room_cleanings where cleaned_by in (select id from _test_staff_ids) or checked_by in (select id from _test_staff_ids);

-- 最後刪掉測試帳號本身
delete from staff where id in (select id from _test_staff_ids);

drop table _test_staff_ids;
