import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

function daysAgo(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

// GET /api/hq/overview
// 各館（不含總公司自己）的今日狀況＋積壓過久的待處理事項
router.get('/overview', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const { data: branches, error: branchErr } = await supabase
      .from('branches')
      .select('id, name, code')
      .neq('code', 'HQ');
    if (branchErr) throw branchErr;

    const result = [];
    for (const branch of branches) {
      const [cleaningsRes, anomaliesRes, defectsRes, managerRes, tasksRes] = await Promise.all([
        supabase.from('room_cleanings').select('id, status, rooms!inner(branch_id)').eq('work_date', today).eq('rooms.branch_id', branch.id),
        supabase.from('anomaly_logs').select('id, detected_at').eq('branch_id', branch.id).eq('resolved', false).order('detected_at'),
        supabase.from('defect_logs').select('id, reported_at').eq('branch_id', branch.id).eq('resolved', false).order('reported_at'),
        supabase.from('manager_task_completions').select('id').eq('branch_id', branch.id).eq('work_date', today).eq('status', 'completed'),
        supabase.from('hq_tasks').select('id').eq('target_branch_id', branch.id).eq('status', 'pending'),
      ]);

      const roomsTotal = cleaningsRes.data?.length ?? 0;
      const roomsCompleted = cleaningsRes.data?.filter((c) => c.status === 'completed').length ?? 0;

      const unresolvedAnomalies = anomaliesRes.data ?? [];
      const unresolvedDefects = defectsRes.data ?? [];
      const oldestAnomalyDays = unresolvedAnomalies.length > 0 ? daysAgo(unresolvedAnomalies[0].detected_at) : null;
      const oldestDefectDays = unresolvedDefects.length > 0 ? daysAgo(unresolvedDefects[0].reported_at) : null;

      result.push({
        branch_id: branch.id,
        branch_name: branch.name,
        rooms_total: roomsTotal,
        rooms_completed: roomsCompleted,
        unresolved_anomalies: unresolvedAnomalies.length,
        oldest_anomaly_days: oldestAnomalyDays,
        unresolved_defects: unresolvedDefects.length,
        oldest_defect_days: oldestDefectDays,
        manager_checklist_done: managerRes.data?.length ?? 0,
        pending_hq_tasks: tasksRes.data?.length ?? 0,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hq/tasks?branch_id=xxx（可選）
router.get('/tasks', async (req, res) => {
  const { branch_id } = req.query;
  let query = supabase
    .from('hq_tasks')
    .select('*, branches:target_branch_id(name)')
    .order('created_at', { ascending: false });
  if (branch_id) query = query.eq('target_branch_id', branch_id);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/hq/tasks  { title, description, target_branch_id, assigned_by, due_date }
router.post('/tasks', async (req, res) => {
  const { data, error } = await supabase.from('hq_tasks').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/hq/tasks/branch?branch_id=xxx&status=pending
// 給館別端（店經理儀表板）用：自己館別的交辦事項
router.get('/tasks/branch', async (req, res) => {
  const { branch_id, status } = req.query;
  let query = supabase.from('hq_tasks').select('*').eq('target_branch_id', branch_id).order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/hq/tasks/:id/complete  { completed_by, response_notes }
router.post('/tasks/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { completed_by, response_notes } = req.body;

  const { data, error } = await supabase
    .from('hq_tasks')
    .update({ status: 'completed', completed_by, response_notes, completed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
