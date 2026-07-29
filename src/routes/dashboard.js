import express from 'express';
import { supabase } from '../supabaseClient.js';
import { calculateBonus } from '../lib/bonusCalc.js';

const router = express.Router();

// GET /api/dashboard/summary?branch_id=xxx&date=2026-07-27
// 店經理儀表板：今日房況、獎金總表、未處理缺失、本月細清進度
router.get('/summary', async (req, res) => {
  const { branch_id, date } = req.query;
  if (!branch_id || !date) return res.status(400).json({ error: '缺少 branch_id 或 date' });

  try {
    // 1. 今日房況總覽
    const { data: cleanings } = await supabase
      .from('room_cleanings')
      .select('id, status, has_defect, rooms!inner(branch_id)')
      .eq('work_date', date)
      .eq('rooms.branch_id', branch_id);

    const totalRooms = cleanings?.length ?? 0;
    const completedRooms = cleanings?.filter((c) => c.status === 'completed').length ?? 0;
    const defectRooms = cleanings?.filter((c) => c.has_defect).length ?? 0;

    // 2. 房務業績獎金總表
    const { data: settings } = await supabase
      .from('bonus_settings')
      .select('*')
      .eq('branch_id', branch_id)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    const target = settings?.daily_target_rooms ?? 12;

    const { data: hkStaff } = await supabase
      .from('staff')
      .select('id, name, roles!inner(category)')
      .eq('branch_id', branch_id)
      .eq('roles.category', 'housekeeping')
      .eq('is_active', true)
      .eq('is_part_time', false);

    const bonusTable = [];
    for (const s of hkStaff ?? []) {
      const { data: ownCleanings } = await supabase
        .from('room_cleanings')
        .select('id, status, has_defect, completed_before_deadline, checked_by')
        .eq('cleaned_by', s.id)
        .eq('work_date', date);

      const assignedCount = ownCleanings?.length ?? 0;
      // 只算客務已經巡房檢查過的房間，還沒確認的不列入獎金
      const completedRows = ownCleanings?.filter((c) => c.status === 'completed' && c.checked_by) ?? [];
      const roomsCompleted = completedRows.length;
      const completedBeforeDeadlineCount = completedRows.filter((c) => c.completed_before_deadline).length;
      const defectCount = completedRows.filter((c) => c.has_defect).length;

      const { bonus_amount, net_rooms, disqualified } = calculateBonus(settings || {}, {
        assignedCount,
        completedBeforeDeadlineCount,
        defectCount,
      });

      bonusTable.push({
        name: s.name,
        rooms_completed: roomsCompleted,
        defect_count: defectCount,
        net_rooms,
        met_target: roomsCompleted >= target,
        disqualified,
        bonus_amount,
      });
    }

    // 3. 未處理缺失清單
    const { data: defects } = await supabase
      .from('defect_logs')
      .select('id, description, reported_at, photo_url, source_type, staff:reported_by(name)')
      .eq('branch_id', branch_id)
      .eq('resolved', false)
      .order('reported_at', { ascending: false })
      .limit(20);

    // 4. 本月樓主細清進度
    const monthStart = date.slice(0, 7) + '-01';
    const { data: deepClean } = await supabase
      .from('deep_clean_assignments')
      .select('id, status, floor:template_id(floor)')
      .eq('branch_id', branch_id)
      .eq('month', monthStart);

    const deepCleanTotal = deepClean?.length ?? 0;
    const deepCleanDone = deepClean?.filter((d) => d.status === 'completed').length ?? 0;

    res.json({
      date,
      rooms: { total: totalRooms, completed: completedRooms, with_defect: defectRooms },
      bonus: { target, rate_type: settings?.rate_type ?? 'linear', staff: bonusTable },
      unresolved_defects: defects ?? [],
      deep_clean: { total: deepCleanTotal, completed: deepCleanDone },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
