import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/manager-reports/today?branch_id=xxx&date=2026-07-27
router.get('/today', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('manager_shift_reports')
    .select('*')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/manager-reports/open   { branch_id, work_date, planned_tasks, staff_id }
router.post('/open', async (req, res) => {
  const { branch_id, work_date, planned_tasks, staff_id } = req.body;
  const { data, error } = await supabase
    .from('manager_shift_reports')
    .upsert(
      { branch_id, work_date, planned_tasks, opened_by: staff_id, opened_at: new Date().toISOString() },
      { onConflict: 'branch_id,work_date' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/manager-reports/close
// { branch_id, work_date, completed_items, pending_items, spot_checks, hq_notes, staff_id }
router.post('/close', async (req, res) => {
  const { branch_id, work_date, completed_items, pending_items, spot_checks, hq_notes, staff_id } = req.body;
  const { data, error } = await supabase
    .from('manager_shift_reports')
    .upsert(
      {
        branch_id, work_date, completed_items, pending_items, spot_checks, hq_notes,
        closed_by: staff_id, closed_at: new Date().toISOString(),
      },
      { onConflict: 'branch_id,work_date' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/manager-reports/list?branch_id=xxx  (歷史清單，總公司或店經理查閱用)
router.get('/list', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('manager_shift_reports')
    .select('*')
    .eq('branch_id', branch_id)
    .order('work_date', { ascending: false })
    .limit(30);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
