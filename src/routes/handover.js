import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/handover/defects-today?branch_id=xxx&date=2026-07-27
// 給交班表「公區、客房設備異常回報」欄位預帶用：今天所有任務回報的異常
router.get('/defects-today', async (req, res) => {
  const { branch_id, date } = req.query;
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;

  const { data, error } = await supabase
    .from('defect_logs')
    .select('id, description, reported_at, staff:reported_by(name)')
    .eq('branch_id', branch_id)
    .gte('reported_at', start)
    .lte('reported_at', end)
    .order('reported_at');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/handover/today?branch_id=xxx&date=2026-07-27&shift_code=B
// 讀取（若已存在）今天這一班的交班表，讓同仁可以編輯已填的內容
router.get('/today', async (req, res) => {
  const { branch_id, date, shift_code } = req.query;
  const { data, error } = await supabase
    .from('shift_handover_reports')
    .select('*')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .eq('shift_code', shift_code)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/handover/list?branch_id=xxx&date=2026-07-27
// 給店經理儀表板：當天所有班別的交班表
router.get('/list', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('shift_handover_reports')
    .select('*')
    .eq('branch_id', branch_id)
    .eq('work_date', date)
    .order('shift_code');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/handover
// 建立或更新（同一天同一班別只會有一筆，重複送出視為更新）
router.post('/', async (req, res) => {
  const payload = req.body;
  if (!payload.branch_id || !payload.work_date || !payload.shift_code) {
    return res.status(400).json({ error: '缺少 branch_id、work_date 或 shift_code' });
  }

  const { data, error } = await supabase
    .from('shift_handover_reports')
    .upsert(payload, { onConflict: 'branch_id,work_date,shift_code' })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
