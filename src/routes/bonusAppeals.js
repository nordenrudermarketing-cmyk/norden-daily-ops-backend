import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/bonus-appeals/mine?staff_id=xxx
router.get('/mine', async (req, res) => {
  const { staff_id } = req.query;
  const { data, error } = await supabase
    .from('bonus_appeals')
    .select('*')
    .eq('staff_id', staff_id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/bonus-appeals  { staff_id, branch_id, work_date, reason }
router.post('/', async (req, res) => {
  const { data, error } = await supabase
    .from('bonus_appeals')
    .upsert({ ...req.body, status: 'pending' }, { onConflict: 'staff_id,work_date' })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/bonus-appeals/pending?branch_id=xxx  （店經理審核用）
router.get('/pending', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('bonus_appeals')
    .select('*, staff:staff_id(name)')
    .eq('branch_id', branch_id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/bonus-appeals/:id/decide  { approved_by, status }  status: approved / rejected
router.post('/:id/decide', async (req, res) => {
  const { id } = req.params;
  const { approved_by, status } = req.body;
  const { data, error } = await supabase
    .from('bonus_appeals')
    .update({ status, approved_by, approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
