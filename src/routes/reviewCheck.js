import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/review-checks/today?branch_id=xxx&date=2026-08-04
// 評論回報是「一天一筆」，四平台各自填當天看到的內容，不是打勾
router.get('/today', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('review_daily_logs')
    .select('*, staff:checked_by(name)')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/review-checks/today
// { branch_id, work_date, bk_note, ag_note, ctrip_note, google_note, special_report, staff_id }
router.post('/today', async (req, res) => {
  const { branch_id, work_date, bk_note, ag_note, ctrip_note, google_note, special_report, staff_id } = req.body;
  const { data, error } = await supabase
    .from('review_daily_logs')
    .upsert(
      { branch_id, work_date, bk_note, ag_note, ctrip_note, google_note, special_report, checked_by: staff_id, checked_at: new Date().toISOString() },
      { onConflict: 'branch_id,work_date' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/review-checks/history?branch_id=xxx  （近期紀錄，方便對照）
router.get('/history', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('review_daily_logs')
    .select('*, staff:checked_by(name)')
    .eq('branch_id', branch_id)
    .order('work_date', { ascending: false })
    .limit(14);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
