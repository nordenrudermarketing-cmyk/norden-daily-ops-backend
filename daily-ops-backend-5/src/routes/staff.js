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

// GET /api/staff/list?branch_id=xxx&category=housekeeping
// 該館某類職務的在職同仁清單（給小隊長分配房號用）
router.get('/staff/list', async (req, res) => {
  const { branch_id, category } = req.query;
  let query = supabase
    .from('staff')
    .select('id, name, roles!inner(name, category)')
    .eq('branch_id', branch_id)
    .eq('is_active', true);

  if (category) query = query.eq('roles.category', category);

  const { data, error } = await query.order('name');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
