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

export default router;
