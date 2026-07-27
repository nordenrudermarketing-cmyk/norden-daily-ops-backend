import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/bonus/daily?branch_id=xxx&date=2026-07-27
// 計算當日每位房務同仁的完成間數、缺失數、淨間數與獎金，並存檔
//
// 假設（依台中館工作分配表）：
//   淨間數 = 完成間數 - 缺失間數
//   獎金 = 淨間數 × 每間單價（bonus_settings.rate_per_room，預設 $20）
//   daily_target_rooms 僅作為「是否達標」的參考標記，不影響金額計算
// 若實際規則不同（例如未達12間不計獎金），請告訴我再調整這段邏輯。
router.get('/daily', async (req, res) => {
  const { branch_id, date } = req.query;

  const { data: settings } = await supabase
    .from('bonus_settings')
    .select('daily_target_rooms, rate_per_room')
    .eq('branch_id', branch_id)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single();

  const target = settings?.daily_target_rooms ?? 12;
  const rate = settings?.rate_per_room ?? 20;

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
      .select('id, has_defect')
      .eq('cleaned_by', staff.id)
      .eq('work_date', date)
      .eq('status', 'completed');

    const roomsCompleted = cleanings?.length ?? 0;
    const defectCount = cleanings?.filter((c) => c.has_defect).length ?? 0;
    const netRooms = Math.max(roomsCompleted - defectCount, 0);
    const bonusAmount = netRooms * rate;

    const { data: saved } = await supabase
      .from('daily_bonus_summary')
      .upsert(
        {
          staff_id: staff.id,
          work_date: date,
          rooms_completed: roomsCompleted,
          defect_count: defectCount,
          net_rooms: netRooms,
          bonus_amount: bonusAmount,
        },
        { onConflict: 'staff_id,work_date' }
      )
      .select()
      .single();

    results.push({
      staff_id: staff.id,
      name: staff.name,
      rooms_completed: roomsCompleted,
      defect_count: defectCount,
      net_rooms: netRooms,
      met_target: roomsCompleted >= target,
      bonus_amount: bonusAmount,
    });
  }

  res.json({ target, rate, results });
});

export default router;
