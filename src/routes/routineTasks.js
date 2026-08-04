import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/routine-tasks?branch_id=xxx&staff_id=xxx(選填，帶了就只回傳分配給這位同仁的項目)
router.get('/', async (req, res) => {
  const { branch_id, staff_id } = req.query;
  let query = supabase
    .from('routine_tasks')
    .select('*, assignee:assigned_to(name)')
    .eq('branch_id', branch_id)
    .order('category')
    .order('created_at');
  if (staff_id) query = query.eq('assigned_to', staff_id);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/routine-tasks  { branch_id, category, item_name, week_note, due_date }
router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('routine_tasks').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// PUT /api/routine-tasks/:id  （店經理：編輯內容/指派負責人）
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('routine_tasks')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/routine-tasks/:id/progress （同仁：更新進度說明/狀態）
router.post('/:id/progress', async (req, res) => {
  const { id } = req.params;
  const { progress_note, status } = req.body;
  const { data, error } = await supabase
    .from('routine_tasks')
    .update({ progress_note, status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
