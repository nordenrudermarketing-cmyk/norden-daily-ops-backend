import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/manager-memo/list?branch_id=xxx
router.get('/list', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('manager_memo_items')
    .select('*, staff:staff_id(name)')
    .eq('branch_id', branch_id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/manager-memo  { branch_id, staff_id, content, status }
router.post('/', async (req, res) => {
  const { branch_id, staff_id, content, status } = req.body;
  if (!content) return res.status(400).json({ error: '請填內容' });
  const { data, error } = await supabase
    .from('manager_memo_items')
    .insert({ branch_id, staff_id, content, status: status || 'todo' })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/manager-memo/:id/status  { status }
router.post('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const payload = { status, updated_at: new Date().toISOString() };
  if (status === 'done') payload.resolved_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('manager_memo_items')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/manager-memo/weekly-report?week_start=2026-08-03（星期一）
// 給總公司看：每館這週的待辦/追蹤中/已完成統計＋項目內容
router.get('/weekly-report', async (req, res) => {
  const { week_start } = req.query;
  const start = new Date(week_start);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const { data: branches, error: branchErr } = await supabase
    .from('branches')
    .select('id, name')
    .neq('code', 'HQ');
  if (branchErr) return res.status(400).json({ error: branchErr.message });

  const result = [];
  for (const branch of branches) {
    const { data: items } = await supabase
      .from('manager_memo_items')
      .select('*, staff:staff_id(name)')
      .eq('branch_id', branch.id)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    const counts = { todo: 0, in_progress: 0, done: 0 };
    (items ?? []).forEach((it) => { counts[it.status] = (counts[it.status] || 0) + 1; });

    result.push({ branch_id: branch.id, branch_name: branch.name, counts, items: items ?? [] });
  }

  res.json(result);
});

export default router;
