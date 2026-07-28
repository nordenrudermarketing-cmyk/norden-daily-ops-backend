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
router.get('/today', async (req, res) => {
  const { branch_id, shift_code, date } = req.query;
  if (!branch_id || !shift_code || !date) {
    return res.status(400).json({ error: '缺少 branch_id、shift_code 或 date' });
  }

  const { data: templates, error } = await supabase
    .from('shift_task_templates')
    .select('id, task_name, schedule_type, schedule_value, sort_order')
    .eq('branch_id', branch_id)
    .eq('shift_code', shift_code)
    .order('sort_order');

  if (error) return res.status(400).json({ error: error.message });

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

  const result = todayTemplates.map((t) => ({
    ...t,
    completion: completionByTemplate[t.id] || null,
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
