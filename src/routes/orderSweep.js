import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/order-sweep/today?branch_id=xxx&date=2026-08-04
router.get('/today', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('order_sweep_logs')
    .select('*')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/order-sweep/today
router.post('/today', async (req, res) => {
  const payload = { ...req.body, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('order_sweep_logs')
    .upsert(payload, { onConflict: 'branch_id,work_date' })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/order-sweep/notes?branch_id=xxx
router.get('/notes', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('order_sweep_notes')
    .select('*, staff:staff_id(name)')
    .eq('branch_id', branch_id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/order-sweep/notes
router.post('/notes', async (req, res) => {
  const { data, error } = await supabase.from('order_sweep_notes').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
