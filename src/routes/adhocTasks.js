import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/adhoc-tasks?branch_id=xxx
router.get('/', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('adhoc_tasks')
    .select('*')
    .eq('branch_id', branch_id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/adhoc-tasks  { branch_id, title, description, due_date, created_by }
// 店經理建立任務時，自動幫全館所有房間建好一筆待分配的紀錄
router.post('/', async (req, res) => {
  const { branch_id, title, description, due_date, created_by } = req.body;
  if (!title) return res.status(400).json({ error: '請填任務標題' });

  const { data: task, error: taskErr } = await supabase
    .from('adhoc_tasks')
    .insert({ branch_id, title, description, due_date, created_by })
    .select()
    .single();
  if (taskErr) return res.status(400).json({ error: taskErr.message });

  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('id')
    .eq('branch_id', branch_id)
    .eq('is_active', true);
  if (roomErr) return res.status(400).json({ error: roomErr.message });

  const rows = rooms.map((r) => ({ task_id: task.id, room_id: r.id, status: 'pending' }));
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('adhoc_task_assignments').insert(rows);
    if (insErr) return res.status(400).json({ error: insErr.message });
  }

  res.json(task);
});

// GET /api/adhoc-tasks/:id/rooms  房號 x 分配狀況表
router.get('/:id/rooms', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('adhoc_task_assignments')
    .select('*, room:room_id(room_number, floor), assignee:assigned_to(name), completer:completed_by(name)')
    .eq('task_id', id)
    .order('room(floor)')
    .order('room(room_number)');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/adhoc-tasks/assignments/:id/assign  { staff_id }  小隊長分配負責人
router.post('/assignments/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { staff_id } = req.body;
  const { data, error } = await supabase
    .from('adhoc_task_assignments')
    .update({ assigned_to: staff_id || null })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/adhoc-tasks/assignments/:id/complete  { staff_id }  任何人都可以打勾（代做也可以）
router.post('/assignments/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { staff_id } = req.body;
  const { data, error } = await supabase
    .from('adhoc_task_assignments')
    .update({ status: 'completed', completed_by: staff_id, completed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/adhoc-tasks/assignments/:id/undo  取消完成（誤觸救援）
router.post('/assignments/:id/undo', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('adhoc_task_assignments')
    .update({ status: 'pending', completed_by: null, completed_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
