-- ============================================================
-- 清除測試資料（第三版：每個步驟都容錯，就算某張表你沒建過也不會中斷）
-- 請到 Supabase SQL Editor 執行
-- ============================================================

create temporary table _test_staff_ids as
select id from staff where name ilike '%測試%' or name ilike '%test%';

do $$
begin
  begin delete from self_eval_submissions where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from daily_reflections where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from weekly_goals where staff_id in (select id from _test_staff_ids) or confirmed_by in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from staff_learning_progress where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from practical_exams where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from assessment_stage_evaluations where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from daily_bonus_summary where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from defect_logs where reported_by in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from anomaly_logs where related_staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from manager_task_completions where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from shift_task_completions where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from deep_clean_assignments where owner_staff_id in (select id from _test_staff_ids) or checked_by in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from room_maintenance_completions where completed_by in (select id from _test_staff_ids) or checked_by in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from paint_inspections where updated_by in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from public_area_maintenance_completions where completed_by in (select id from _test_staff_ids) or assigned_to in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from zone_owners where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from floor_owners where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from daily_team_leads where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from staff_schedule where staff_id in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from shift_handover_reports where submitted_by in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin update hq_tasks set completed_by = null where completed_by in (select id from _test_staff_ids); exception when undefined_table then null; end;
  begin delete from room_cleanings where cleaned_by in (select id from _test_staff_ids) or checked_by in (select id from _test_staff_ids); exception when undefined_table then null; end;
end $$;

delete from staff where id in (select id from _test_staff_ids);

drop table _test_staff_ids;
