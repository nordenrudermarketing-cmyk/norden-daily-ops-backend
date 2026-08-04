import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/no-show?branch_id=xxx&date=2026-07-27
router.get('/', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('no_show_records')
    .select('*, staff:reported_by(name)')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/no-show
router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('no_show_records').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
