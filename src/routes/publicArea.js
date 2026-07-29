import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

function weekOfMonth(dateStr) {
  const day = Number(dateStr.slice(8, 10));
  return Math.ceil(day / 7); // 1~5
}

// GET /api/public-area-maintenance/today?branch_id=xxx&date=2026-07-27&staff_id=xxx(選填)
// 今日公區：早上/下午日常 + 隊長任務 + 符合本週的每週輪替項目
// 有帶 staff_id 時，只回傳小隊長分配給這位同仁的項目（給同仁打卡頁用）
// 沒帶 staff_id 時，回傳全部項目（給小隊長分配頁用）
router.get('/today', async (req, res) => {
  const { branch_id, date, staff_id } = req.query;
  const wom = weekOfMonth(date);
  const weeklyCycle = wom % 2 === 1 ? 'weekly_odd' : 'weekly_even';

  const { data: templates, error } = await supabase
    .from('public_area_maintenance_templates')
    .select('*')
    .eq('branch_id', branch_id)
    .in('cycle', ['daily_am', 'daily_pm', 'team_lead', weeklyCycle])
    .order('sort_order');
  if (error) return res.status(400).json({ error: error.message });

  const { data: completions } = await supabase
    .from('public_area_maintenance_completions')
    .select('template_id, status, assigned_to, completed_by, completed_at, staff:completed_by(name)')
    .eq('branch_id', branch_id)
    .eq('period_key', date);

  const compMap = {};
  (completions ?? []).forEach((c) => { compMap[c.template_id] = c; });

  let result = (templates ?? []).map((t) => ({ ...t, completion: compMap[t.id] || null }));
  if (staff_id) {
    result = result.filter((t) => t.completion?.assigned_to === staff_id);
  }

  res.json(result);
});

// GET /api/public-area-maintenance/month?branch_id=xxx&month=2026-07&staff_id=xxx(選填)
// 本月/本季公區：月清 + 符合當季的季清 + 符合當月奇偶的雙月清
router.get('/month', async (req, res) => {
  const { branch_id, month, staff_id } = req.query;
  const monthNum = Number(month.slice(5, 7));
  const quarterGroup = ((monthNum - 1) % 3) + 1;
  const bimonthlyCycle = monthNum % 2 === 1 ? 'bimonthly_odd' : 'bimonthly_even';

  const { data: templates, error } = await supabase
    .from('public_area_maintenance_templates')
    .select('*')
    .eq('branch_id', branch_id)
    .order('sort_order');
  if (error) return res.status(400).json({ error: error.message });

  const applicable = (templates ?? []).filter(
    (t) => t.cycle === 'monthly' ||
      (t.cycle === 'quarterly' && t.quarter_group === quarterGroup) ||
      t.cycle === bimonthlyCycle
  );

  const { data: completions } = await supabase
    .from('public_area_maintenance_completions')
    .select('template_id, status, assigned_to, completed_by, completed_at, staff:completed_by(name)')
    .eq('branch_id', branch_id)
    .eq('period_key', month);

  const compMap = {};
  (completions ?? []).forEach((c) => { compMap[c.template_id] = c; });

  let result = applicable.map((t) => ({ ...t, completion: compMap[t.id] || null }));
  if (staff_id) {
    result = result.filter((t) => t.completion?.assigned_to === staff_id);
  }

  res.json(result);
});

// POST /api/public-area-maintenance/assign-batch
// { branch_id, period_key, assignments: [{ template_id, staff_id }] }
// 小隊長分配。已經完成的項目不會被覆蓋（避免洗掉完成紀錄，邏輯跟房號分配一致）
router.post('/assign-batch', async (req, res) => {
  const { branch_id, period_key, assignments } = req.body;
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: '沒有分配任何項目' });
  }

  const templateIds = assignments.map((a) => a.template_id);
  const { data: existing, error: existingErr } = await supabase
    .from('public_area_maintenance_completions')
    .select('template_id, status')
    .eq('branch_id', branch_id)
    .eq('period_key', period_key)
    .in('template_id', templateIds);
  if (existingErr) return res.status(400).json({ error: existingErr.message });

  const completedIds = new Set((existing ?? []).filter((r) => r.status === 'completed').map((r) => r.template_id));

  const rows = assignments
    .filter((a) => !completedIds.has(a.template_id))
    .map((a) => ({ template_id: a.template_id, branch_id, period_key, assigned_to: a.staff_id, status: 'pending' }));

  if (rows.length === 0) return res.json([]);

  const { data, error } = await supabase
    .from('public_area_maintenance_completions')
    .upsert(rows, { onConflict: 'template_id,period_key' })
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/public-area-maintenance/:id/complete
// { branch_id, staff_id, period_key, notes }
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { branch_id, staff_id, period_key, notes } = req.body;

  const { data, error } = await supabase
    .from('public_area_maintenance_completions')
    .upsert(
      { template_id: id, branch_id, period_key, status: 'completed', completed_by: staff_id, completed_at: new Date().toISOString(), notes },
      { onConflict: 'template_id,period_key' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
