import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// POST /api/login  { login_code, password }
// 兩段式登入：
// 1. 只帶 login_code（沒帶 password）→ 查這個人有沒有設定過密碼，回報前端該顯示哪個畫面
// 2. 帶 login_code + password → 驗證密碼是否正確，正確才回傳完整同仁資料
router.post('/login', async (req, res) => {
  const { login_code, password } = req.body;
  if (!login_code) return res.status(400).json({ error: '缺少 login_code' });

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, branch_id, role_id, is_active, password_hash, roles(name, category)')
    .eq('login_code', login_code)
    .eq('is_active', true)
    .single();

  if (error || !data) return res.status(401).json({ error: '登入代碼錯誤或帳號已停用' });

  // 這位同仁還沒設定過密碼：第一次登入，先引導設定，不要在這一步就登入
  if (!data.password_hash) {
    return res.json({ needs_password_setup: true, staff_id: data.id });
  }

  // 已經有密碼：一定要帶密碼來比對
  if (!password) {
    return res.status(401).json({ error: '請輸入密碼', needs_password: true });
  }

  const match = await bcrypt.compare(password, data.password_hash);
  if (!match) return res.status(401).json({ error: '密碼錯誤' });

  delete data.password_hash; // 不要把雜湊值傳到前端
  res.json(data);
});

// POST /api/set-password  { login_code, password }
// 第一次登入設定密碼用；如果這個帳號已經有密碼了，會拒絕（要改密碼要用別的流程，不是這支）
router.post('/set-password', async (req, res) => {
  const { login_code, password } = req.body;
  if (!login_code || !password) return res.status(400).json({ error: '缺少登入代碼或密碼' });

  const { data: existing, error: findErr } = await supabase
    .from('staff')
    .select('id, password_hash')
    .eq('login_code', login_code)
    .eq('is_active', true)
    .single();

  if (findErr || !existing) return res.status(401).json({ error: '登入代碼錯誤或帳號已停用' });
  if (existing.password_hash) return res.status(400).json({ error: '這個帳號已經設定過密碼了' });

  const hash = await bcrypt.hash(password, 10);
  const { error: updateErr } = await supabase
    .from('staff')
    .update({ password_hash: hash })
    .eq('id', existing.id);

  if (updateErr) return res.status(400).json({ error: updateErr.message });
  res.json({ ok: true });
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
