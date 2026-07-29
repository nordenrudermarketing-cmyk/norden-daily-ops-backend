import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

function isoWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day; // 轉成 1=週一..7=週日
}

// GET /api/shift-tasks/today?branch_id=xxx&shift_code=C&date=2026-07-27
// 該班別當天應該出現的任務（依 daily / weekday / monthly_date 規則過濾）
//
// 依當天實際排班切換整套任務清單：如果今天有排 C 班就用「ABC」版本，
// 沒有排 C 班（例如 AABB）就用「AABB」版本——AABB 版本的內容是館別自己
// 把 C 班工作拆開揉進 A、B 班的實際清單，不是系統自動合併，所以兩套內容
// 分開存、分開建置。如果某個班別沒有對應排班型態的版本，會自動退回 ABC 版本。
router.get('/today', async (req, res) => {
  const { branch_id, shift_code, date } = req.query;
  if (!branch_id || !shift_code || !date) {
    return res.status(400).json({ error: '缺少 branch_id、shift_code 或 date' });
  }

  // 查今天實際排班，看有沒有排 C 班
  const { data: todaySchedule } = await supabase
    .from('staff_schedule')
    .select('shift_code')
    .eq('branch_id', branch_id)
    .eq('work_date', date);
  const hasCToday = (todaySchedule ?? []).some((s) => s.shift_code === 'C');
  const targetPattern = hasCToday ? 'ABC' : 'AABB';

  let { data: templates, error } = await supabase
    .from('shift_task_templates')
    .select('id, task_name, schedule_type, schedule_value, sort_order, shift_code, schedule_pattern')
    .eq('branch_id', branch_id)
    .eq('shift_code', shift_code)
    .eq('schedule_pattern', targetPattern)
    .eq('is_active', true)
    .order('sort_order');

  if (error) return res.status(400).json({ error: error.message });

  // 沒有這個班別的 AABB 版本（例如館別沒建、或這個班別本來就不受影響），退回 ABC 版本
  if ((templates ?? []).length === 0 && targetPattern !== 'ABC') {
    const fallback = await supabase
      .from('shift_task_templates')
      .select('id, task_name, schedule_type, schedule_value, sort_order, shift_code, schedule_pattern')
      .eq('branch_id', branch_id)
      .eq('shift_code', shift_code)
      .eq('schedule_pattern', 'ABC')
      .eq('is_active', true)
      .order('sort_order');
    templates = fallback.data;
  }

  const weekday = isoWeekday(date);
  const dayOfMonth = Number(date.slice(8, 10));

  const todayTemplates = (templates ?? []).filter((t) => {
    if (t.schedule_type === 'daily') return true;
    if (t.schedule_type === 'weekday') {
      return (t.schedule_value || '').split(',').map(Number).includes(weekday);
    }
    if (t.schedule_type === 'monthly_date') {
      return (t.schedule_value || '').split(',').map(Number).includes(dayOfMonth);
    }
    return false;
  });

  const templateIds = todayTemplates.map((t) => t.id);
  const { data: completions } = await supabase
    .from('shift_task_completions')
    .select('template_id, status, completed_at, staff:staff_id(name)')
    .in('template_id', templateIds.length ? templateIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('work_date', date);

  const completionByTemplate = {};
  (completions ?? []).forEach((c) => { completionByTemplate[c.template_id] = c; });

  // 同一天、同一項任務的異常回報也不分人——A班兩位同仁誰報告的都算數，另一位要看得到
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;
  const { data: reports } = await supabase
    .from('defect_logs')
    .select('id, source_id, description, reported_at, staff:reported_by(name)')
    .eq('source_type', 'shift_task')
    .in('source_id', templateIds.length ? templateIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('reported_at', start)
    .lte('reported_at', end)
    .order('reported_at');

  const reportsByTemplate = {};
  (reports ?? []).forEach((r) => {
    reportsByTemplate[r.source_id] = reportsByTemplate[r.source_id] || [];
    reportsByTemplate[r.source_id].push(r);
  });

  const result = todayTemplates.map((t) => ({
    ...t,
    completion: completionByTemplate[t.id] || null,
    reports: reportsByTemplate[t.id] || [],
  }));

  res.json(result);
});

// POST /api/shift-tasks/:id/complete  { staff_id, work_date, notes }
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { staff_id, work_date, notes } = req.body;

  const { data, error } = await supabase
    .from('shift_task_completions')
    .upsert(
      { template_id: id, staff_id, work_date, status: 'completed', completed_at: new Date().toISOString(), notes },
      { onConflict: 'template_id,staff_id,work_date' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
