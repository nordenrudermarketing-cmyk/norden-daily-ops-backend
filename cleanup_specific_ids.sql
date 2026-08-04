-- ============================================================
-- 清除指定的測試帳號（1-A、1館C班、Dale）
-- 請到 Supabase SQL Editor 執行
-- ============================================================

do $$
declare
  target_ids uuid[] := array[
    'bb22fe23-3033-4446-aa95-b023f92f1a88',  -- 1-A
    '34970c3a-b0e7-4cc4-bf13-d765559506da',  -- 1館C班
    '5d08c386-eb5b-49e1-90d2-a7c34e0453f4'   -- Dale
  ];
begin
  begin delete from self_eval_submissions where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from daily_reflections where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from weekly_goals where staff_id = any(target_ids) or confirmed_by = any(target_ids); exception when undefined_table then null; end;
  begin delete from staff_learning_progress where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from practical_exams where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from assessment_stage_evaluations where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from daily_bonus_summary where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from defect_logs where reported_by = any(target_ids); exception when undefined_table then null; end;
  begin delete from anomaly_logs where related_staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from manager_task_completions where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from shift_task_completions where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from deep_clean_assignments where owner_staff_id = any(target_ids) or checked_by = any(target_ids); exception when undefined_table then null; end;
  begin delete from room_maintenance_completions where completed_by = any(target_ids) or checked_by = any(target_ids); exception when undefined_table then null; end;
  begin delete from paint_inspections where updated_by = any(target_ids); exception when undefined_table then null; end;
  begin delete from public_area_maintenance_completions where completed_by = any(target_ids) or assigned_to = any(target_ids); exception when undefined_table then null; end;
  begin delete from zone_owners where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from floor_owners where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from daily_team_leads where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from staff_schedule where staff_id = any(target_ids); exception when undefined_table then null; end;
  begin delete from shift_handover_reports where submitted_by = any(target_ids); exception when undefined_table then null; end;
  begin update hq_tasks set completed_by = null where completed_by = any(target_ids); exception when undefined_table then null; end;
  begin delete from room_cleanings where cleaned_by = any(target_ids) or checked_by = any(target_ids); exception when undefined_table then null; end;
  begin delete from staff where id = any(target_ids); exception when undefined_table then null; end;
end $$;
