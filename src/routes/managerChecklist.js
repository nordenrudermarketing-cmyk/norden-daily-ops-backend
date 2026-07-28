import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/manager-checklist/today?branch_id=xxx&date=2026-07-28
router.get('/today', async (req, res) => {
  const { branch_id, date } = req.query;

  try {
    const [templatesRes, completionsRes] = await Promise.all([
      supabase.from('manager_task_templates').select('*').eq('branch_id', branch_id).eq('is_active', true).order('sort_order'),
      supabase.from('manager_task_completions').select('*').eq('branch_id', branch_id).eq('work_date', date),
    ]);
    if (templatesRes.error) throw templatesRes.error;

    const completionByTemplate = {};
    (completionsRes.data ?? []).forEach((c) => { completionByTemplate[c.template_id] = c; });

    // 今日房況（給「住房率確認」帶入參考數字）
    const { data: cleanings } = await supabase
      .from('room_cleanings')
      .select('id, status, rooms!inner(branch_id)')
      .eq('work_date', date)
      .eq('rooms.branch_id', branch_id);
    const roomsTotal = cleanings?.length ?? 0;
    const roomsCompleted = cleanings?.filter((c) => c.status === 'completed').length ?? 0;

    // 今日排班人力（給「人力配置確認」帶入參考數字）
    const { data: schedule } = await supabase
      .from('staff_schedule')
      .select('shift_code, staff:staff_id(roles(category))')
      .eq('branch_id', branch_id)
      .eq('work_date', date);
    const onDutyFrontdesk = (schedule ?? []).filter((s) => s.staff?.roles?.category === 'frontdesk' && s.shift_code !== '1').length;
    const onDutyHousekeeping = (schedule ?? []).filter((s) => s.shift_code === '房').length;

    const suggestedNotes = {
      '今日及未來住房率確認': `今日已完成房務 ${roomsCompleted}/${roomsTotal} 間`,
      '人力配置確認': `今日排班：客務 ${onDutyFrontdesk} 人、房務 ${onDutyHousekeeping} 人`,
    };

    const result = templatesRes.data.map((t) => ({
      ...t,
      completion: completionByTemplate[t.id] || null,
      suggested_note: suggestedNotes[t.task_name] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/manager-checklist/:templateId/complete
// { staff_id, branch_id, work_date, notes }
router.post('/:templateId/complete', async (req, res) => {
  const { templateId } = req.params;
  const { staff_id, branch_id, work_date, notes } = req.body;

  const { data, error } = await supabase
    .from('manager_task_completions')
    .upsert(
      { template_id: templateId, staff_id, branch_id, work_date, status: 'completed', notes, completed_at: new Date().toISOString() },
      { onConflict: 'template_id,work_date' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
