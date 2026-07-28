import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/templates/shift-tasks?branch_id=xxx
// 給店經理管理頁用：列出全部（含已停用），方便重新啟用
router.get('/shift-tasks', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('shift_task_templates')
    .select('*')
    .eq('branch_id', branch_id)
    .order('shift_code')
    .order('sort_order');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/templates/shift-tasks  新增一項任務
router.post('/shift-tasks', async (req, res) => {
  const { branch_id, shift_code, task_name, schedule_type, schedule_value, sort_order } = req.body;
  const { data, error } = await supabase
    .from('shift_task_templates')
    .insert({ branch_id, shift_code, task_name, schedule_type, schedule_value, sort_order: sort_order || 0 })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// PUT /api/templates/shift-tasks/:id  編輯內容
router.put('/shift-tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { task_name, shift_code, schedule_type, schedule_value, sort_order } = req.body;
  const { data, error } = await supabase
    .from('shift_task_templates')
    .update({ task_name, shift_code, schedule_type, schedule_value, sort_order })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/templates/shift-tasks/:id/toggle  啟用/停用（不會刪除，保留歷史回報紀錄的關聯）
router.post('/shift-tasks/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  const { data, error } = await supabase
    .from('shift_task_templates')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
