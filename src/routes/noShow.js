import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/no-show/today?branch_id=xxx&date=2026-08-04
// NO SHOW也是「一天一筆」，沒發生就寫「無」
router.get('/today', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('no_show_daily_logs')
    .select('*, staff:reported_by(name)')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/no-show/today
// { branch_id, work_date, order_info, charged_note, uncharged_note, note, staff_id }
router.post('/today', async (req, res) => {
  const { branch_id, work_date, order_info, charged_note, uncharged_note, note, staff_id } = req.body;
  const { data, error } = await supabase
    .from('no_show_daily_logs')
    .upsert(
      { branch_id, work_date, order_info, charged_note, uncharged_note, note, reported_by: staff_id, reported_at: new Date().toISOString() },
      { onConflict: 'branch_id,work_date' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/no-show/history?branch_id=xxx
router.get('/history', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('no_show_daily_logs')
    .select('*, staff:reported_by(name)')
    .eq('branch_id', branch_id)
    .order('work_date', { ascending: false })
    .limit(14);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
