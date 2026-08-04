-- ============================================================
-- 清除測試資料（第四版：不使用暫存表，避免 Supabase SQL Editor 的連線問題）
-- 請到 Supabase SQL Editor 執行
-- ============================================================

do $$
declare
  test_condition text := '(select id from staff where name ilike ''%測試%'' or name ilike ''%test%'')';
begin
  begin execute 'delete from self_eval_submissions where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from daily_reflections where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from weekly_goals where staff_id in ' || test_condition || ' or confirmed_by in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from staff_learning_progress where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from practical_exams where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from assessment_stage_evaluations where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from daily_bonus_summary where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from defect_logs where reported_by in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from anomaly_logs where related_staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from manager_task_completions where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from shift_task_completions where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from deep_clean_assignments where owner_staff_id in ' || test_condition || ' or checked_by in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from room_maintenance_completions where completed_by in ' || test_condition || ' or checked_by in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from paint_inspections where updated_by in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from public_area_maintenance_completions where completed_by in ' || test_condition || ' or assigned_to in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from zone_owners where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from floor_owners where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from daily_team_leads where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from staff_schedule where staff_id in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from shift_handover_reports where submitted_by in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'update hq_tasks set completed_by = null where completed_by in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from room_cleanings where cleaned_by in ' || test_condition || ' or checked_by in ' || test_condition; exception when undefined_table then null; end;
  begin execute 'delete from staff where name ilike ''%測試%'' or name ilike ''%test%'''; exception when undefined_table then null; end;
end $$;
