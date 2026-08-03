import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();
const PLATFORMS = ['BK', 'AG', 'Ctrip', 'Google'];

// GET /api/review-checks/today?branch_id=xxx&date=2026-07-27
router.get('/today', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('review_checks')
    .select('*, staff:checked_by(name)')
    .eq('branch_id', branch_id)
    .eq('work_date', date);
  if (error) return res.status(400).json({ error: error.message });

  const map = {};
  (data ?? []).forEach((r) => { map[r.platform] = r; });

  res.json(PLATFORMS.map((p) => ({ platform: p, ...map[p] })));
});

// POST /api/review-checks/check
// { branch_id, work_date, platform, staff_id, note }
router.post('/check', async (req, res) => {
  const { branch_id, work_date, platform, staff_id, note } = req.body;
  const { data, error } = await supabase
    .from('review_checks')
    .upsert(
      { branch_id, work_date, platform, status: 'checked', checked_by: staff_id, checked_at: new Date().toISOString(), note },
      { onConflict: 'branch_id,work_date,platform' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
