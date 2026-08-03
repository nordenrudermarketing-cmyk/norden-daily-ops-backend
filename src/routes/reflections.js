import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// ---------- 每日自評 ----------

// GET /api/reflections/daily?staff_id=xxx&date=2026-07-27
router.get('/daily', async (req, res) => {
  const { staff_id, date } = req.query;
  const { data, error } = await supabase
    .from('daily_reflections')
    .select('*')
    .eq('staff_id', staff_id)
    .eq('work_date', date)
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/reflections/daily
router.post('/daily', async (req, res) => {
  const payload = req.body;
  const { data, error } = await supabase
    .from('daily_reflections')
    .upsert(payload, { onConflict: 'staff_id,work_date' })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/reflections/daily/branch?branch_id=xxx&date=2026-07-27
// 給店經理看：這天所有同仁的每日自評（有填才會出現）
router.get('/daily/branch', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('daily_reflections')
    .select('*, staff:staff_id(name)')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .order('submitted_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------- 每週目標確認 ----------

// GET /api/reflections/weekly?staff_id=xxx&week_start=2026-07-27
router.get('/weekly', async (req, res) => {
  const { staff_id, week_start } = req.query;
  const { data, error } = await supabase
    .from('weekly_goals')
    .select('*')
    .eq('staff_id', staff_id)
    .eq('week_start', week_start)
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/reflections/weekly
router.post('/weekly', async (req, res) => {
  const payload = req.body;
  const { data, error } = await supabase
    .from('weekly_goals')
    .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: 'staff_id,week_start' })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/reflections/weekly/branch?branch_id=xxx&week_start=2026-07-27
// 給店經理看：這週所有同仁的目標確認狀態
router.get('/weekly/branch', async (req, res) => {
  const { branch_id, week_start } = req.query;

  const { data: staffList, error: staffErr } = await supabase
    .from('staff')
    .select('id, name')
    .eq('branch_id', branch_id)
    .eq('is_active', true);
  if (staffErr) return res.status(400).json({ error: staffErr.message });

  const { data: goals } = await supabase
    .from('weekly_goals')
    .select('*')
    .eq('branch_id', branch_id)
    .eq('week_start', week_start);

  const goalMap = {};
  (goals ?? []).forEach((g) => { goalMap[g.staff_id] = g; });

  res.json(staffList.map((s) => ({ staff_id: s.id, name: s.name, goal: goalMap[s.id] || null })));
});

// POST /api/reflections/weekly/:id/confirm  { confirmed_by }
router.post('/weekly/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { confirmed_by } = req.body;
  const { data, error } = await supabase
    .from('weekly_goals')
    .update({ status: 'confirmed', confirmed_by, confirmed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
