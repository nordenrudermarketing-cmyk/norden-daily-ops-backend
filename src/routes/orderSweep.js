import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/order-sweep/list?branch_id=xxx&date=2026-08-04
router.get('/list', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('order_sweep_logs')
    .select('*, staff:updated_by(name)')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .order('updated_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/order-sweep  （每次都是新增一筆，不是覆蓋當天資料）
router.post('/', async (req, res) => {
  const payload = { ...req.body, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('order_sweep_logs')
    .insert(payload)
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
