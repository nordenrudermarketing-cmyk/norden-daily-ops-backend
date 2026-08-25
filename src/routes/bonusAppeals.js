import express from 'express';
import { supabase } from '../supabaseClient.js';
import { calculateBonus } from '../lib/bonusCalc.js';

const router = express.Router();

// GET /api/bonus-appeals/day-stats?staff_id=xxx&branch_id=xxx&date=2026-08-24
// 給同仁申覆前先看：那天系統實際算出來的間數跟獎金，方便他知道要申覆成幾間
router.get('/day-stats', async (req, res) => {
  const { staff_id, branch_id, date } = req.query;

  const { data: settings } = await supabase.from('bonus_settings').select('*').eq('branch_id', branch_id).maybeSingle();

  const { data: cleanings } = await supabase
    .from('room_cleanings')
    .select('id, status, has_defect, completed_before_deadline, checked_by')
    .eq('cleaned_by', staff_id)
    .eq('work_date', date);

  const assignedCount = cleanings?.length ?? 0;
  const completedRows = cleanings?.filter((c) => c.status === 'completed' && c.checked_by) ?? [];
  const roomsCompleted = completedRows.length;
  const beforeDeadlineRows = completedRows.filter((c) => c.completed_before_deadline);
  const completedBeforeDeadlineCount = beforeDeadlineRows.length;
  const defectCount = beforeDeadlineRows.filter((c) => c.has_defect).length;

  const result = calculateBonus(settings || {}, { assignedCount, completedBeforeDeadlineCount, defectCount });

  res.json({
    assigned_count: assignedCount,
    rooms_completed: roomsCompleted,
    completed_before_deadline: completedBeforeDeadlineCount,
    defect_count: defectCount,
    net_rooms: result.net_rooms,
    disqualified: result.disqualified,
    bonus_amount: result.bonus_amount,
  });
});

// GET /api/bonus-appeals/mine?staff_id=xxx
router.get('/mine', async (req, res) => {
  const { staff_id } = req.query;
  const { data, error } = await supabase
    .from('bonus_appeals')
    .select('*')
    .eq('staff_id', staff_id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/bonus-appeals  { staff_id, branch_id, work_date, requested_rooms, reason }
router.post('/', async (req, res) => {
  const { staff_id, branch_id, work_date, requested_rooms, reason } = req.body;
  if (!requested_rooms || !reason) return res.status(400).json({ error: '請填申覆間數跟理由' });

  const { data, error } = await supabase
    .from('bonus_appeals')
    .upsert(
      { staff_id, branch_id, work_date, requested_rooms, reason, status: 'pending', reject_reason: null, approved_by: null, approved_at: null },
      { onConflict: 'staff_id,work_date' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/bonus-appeals/pending?branch_id=xxx  （店經理審核用，含當天原始數據給經理對照）
router.get('/pending', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('bonus_appeals')
    .select('*, staff:staff_id(name)')
    .eq('branch_id', branch_id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/bonus-appeals/:id/decide  { approved_by, status, reject_reason }
// status: approved / rejected；駁回時 reject_reason 必填
router.post('/:id/decide', async (req, res) => {
  const { id } = req.params;
  const { approved_by, status, reject_reason } = req.body;

  if (status === 'rejected' && !reject_reason) {
    return res.status(400).json({ error: '駁回請填寫原因' });
  }

  const { data, error } = await supabase
    .from('bonus_appeals')
    .update({
      status,
      approved_by,
      approved_at: new Date().toISOString(),
      reject_reason: status === 'rejected' ? reject_reason : null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
