import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// POST /api/login  { login_code }
// 簡易登入：用 login_code 換回同仁資料（含職務、館別）
router.post('/login', async (req, res) => {
  const { login_code } = req.body;
  if (!login_code) return res.status(400).json({ error: '缺少 login_code' });

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, branch_id, role_id, is_active, roles(name, category)')
    .eq('login_code', login_code)
    .eq('is_active', true)
    .single();

  if (error || !data) return res.status(401).json({ error: '登入代碼錯誤或帳號已停用' });
  res.json(data);
});

// GET /api/staff/list?branch_id=xxx&category=housekeeping&learning_enabled=true(選填)
// 該館某類職務的在職同仁清單（給小隊長分配房號、學習地圖選人用）
router.get('/staff/list', async (req, res) => {
  const { branch_id, category, learning_enabled } = req.query;
  let query = supabase
    .from('staff')
    .select('id, name, learning_map_enabled, roles!inner(name, category)')
    .eq('branch_id', branch_id)
    .eq('is_active', true);

  if (category) query = query.eq('roles.category', category);
  if (learning_enabled === 'true') query = query.eq('learning_map_enabled', true);

  const { data, error } = await query.order('name');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/staff/:id/learning-map-toggle  { enabled }
// 店經理：開啟/關閉某位同仁的學習地圖
router.post('/staff/:id/learning-map-toggle', async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;
  const { data, error } = await supabase
    .from('staff')
    .update({ learning_map_enabled: enabled })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
