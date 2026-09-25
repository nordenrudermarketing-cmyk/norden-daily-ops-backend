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
      const [cleaningsRes, anomaliesRes, defectsRes, managerRes] = await Promise.all([
        supabase.from('room_cleanings').select('id, status, rooms!inner(branch_id)').eq('work_date', today).eq('rooms.branch_id', branch.id),
        supabase.from('anomaly_logs').select('id, detected_at').eq('branch_id', branch.id).eq('resolved', false).order('detected_at'),
        supabase.from('defect_logs').select('id, reported_at').eq('branch_id', branch.id).eq('resolved', false).order('reported_at'),
        supabase.from('manager_task_completions').select('id').eq('branch_id', branch.id).eq('work_date', today).eq('status', 'completed'),
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
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 原本的「總公司交辦任務」（/api/hq/tasks）已由待辦事項（/api/todos）取代。
// 舊資料還留在 hq_tasks 資料表裡，沒有刪除。

export default router;
