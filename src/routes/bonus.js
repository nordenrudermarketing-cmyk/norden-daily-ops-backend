import express from 'express';
import { supabase } from '../supabaseClient.js';
import { calculateBonus } from '../lib/bonusCalc.js';

const router = express.Router();

// GET /api/bonus/daily?branch_id=xxx&date=2026-07-27
// 計算當日每位房務同仁的完成間數、缺失數、淨間數與獎金，並存檔
//
// 各館規則可能不同（存在 bonus_settings.rate_type）：
//   linear：淨間數 × 固定單價（例如台中館）
//   tiered：級距制，例如前12間$10、第13間起$20（例如台東1館）
//   require_full_completion：true 代表當天沒有在期限前把被分配的房間全部完成，整天不算獎金
router.get('/daily', async (req, res) => {
  const { branch_id, date } = req.query;

  const { data: settings } = await supabase
    .from('bonus_settings')
    .select('*')
    .eq('branch_id', branch_id)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single();

  const target = settings?.daily_target_rooms ?? 12;

  const { data: staffList, error: staffErr } = await supabase
    .from('staff')
    .select('id, name, roles!inner(category)')
    .eq('branch_id', branch_id)
    .eq('roles.category', 'housekeeping')
    .eq('is_active', true);

  if (staffErr) return res.status(400).json({ error: staffErr.message });

  const results = [];

  for (const staff of staffList) {
    const { data: cleanings } = await supabase
      .from('room_cleanings')
      .select('id, status, has_defect, completed_before_deadline')
      .eq('cleaned_by', staff.id)
      .eq('work_date', date);

    const assignedCount = cleanings?.length ?? 0;
    const completedRows = cleanings?.filter((c) => c.status === 'completed') ?? [];
    const roomsCompleted = completedRows.length;
    const completedBeforeDeadlineCount = completedRows.filter((c) => c.completed_before_deadline).length;
    const defectCount = completedRows.filter((c) => c.has_defect).length;

    const { bonus_amount, net_rooms, disqualified } = calculateBonus(settings || {}, {
      assignedCount,
      completedBeforeDeadlineCount,
      defectCount,
    });

    await supabase
      .from('daily_bonus_summary')
      .upsert(
        {
          staff_id: staff.id,
          work_date: date,
          rooms_completed: roomsCompleted,
          defect_count: defectCount,
          net_rooms: net_rooms,
          bonus_amount: bonus_amount,
        },
        { onConflict: 'staff_id,work_date' }
      )
      .select()
      .single();

    results.push({
      staff_id: staff.id,
      name: staff.name,
      assigned_count: assignedCount,
      rooms_completed: roomsCompleted,
      completed_before_deadline: completedBeforeDeadlineCount,
      defect_count: defectCount,
      net_rooms,
      met_target: roomsCompleted >= target,
      disqualified,
      bonus_amount,
    });
  }

  res.json({ target, rate_type: settings?.rate_type ?? 'linear', results });
});

export default router;
