import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// POST /api/login  { login_code, password }
// 一頁式登入：登入代碼＋密碼一起送出
// 這位同仁還沒設定過密碼的話（第一次登入），這次輸入的密碼會直接變成他的新密碼
router.post('/login', async (req, res) => {
  const { login_code, password } = req.body;
  if (!login_code) return res.status(400).json({ error: '缺少 login_code' });
  if (!password) return res.status(400).json({ error: '請輸入密碼' });

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, branch_id, role_id, is_active, password_hash, roles(name, category)')
    .eq('login_code', login_code)
    .eq('is_active', true)
    .single();

  if (error || !data) return res.status(401).json({ error: '登入代碼錯誤或帳號已停用' });

  if (!data.password_hash) {
    // 第一次登入：這次輸入的密碼直接設成新密碼
    const hash = await bcrypt.hash(password, 10);
    const { error: setErr } = await supabase.from('staff').update({ password_hash: hash }).eq('id', data.id);
    if (setErr) return res.status(400).json({ error: setErr.message });
  } else {
    const match = await bcrypt.compare(password, data.password_hash);
    if (!match) return res.status(401).json({ error: '密碼錯誤' });
  }

  delete data.password_hash; // 不要把雜湊值傳到前端
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

// POST /api/staff/:id/reset-password
// 清空密碼，該同仁下次登入會自動跳回「第一次登入設定密碼」的畫面
router.post('/staff/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('staff')
    .update({ password_hash: null })
    .eq('id', id)
    .select('id, name')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/staff/password-status?branch_id=xxx(選填，不帶就是全部館別，給總公司用)
// 只回傳「有沒有設定密碼」，不會回傳密碼本身或雜湊值
router.get('/staff/password-status', async (req, res) => {
  const { branch_id } = req.query;
  let query = supabase
    .from('staff')
    .select('id, name, password_hash, branch_id, branches(name), roles(name)')
    .eq('is_active', true);
  if (branch_id) query = query.eq('branch_id', branch_id);

  const { data, error } = await query.order('name');
  if (error) return res.status(400).json({ error: error.message });

  res.json(data.map((s) => ({
    id: s.id,
    name: s.name,
    branch_name: s.branches?.name,
    role_name: s.roles?.name,
    has_password: !!s.password_hash,
  })));
});

export default router;
