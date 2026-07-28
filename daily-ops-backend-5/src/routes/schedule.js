import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/schedule/today?staff_id=xxx&date=2026-07-28
// 給登入流程用：查今天這位同仁實際排的班別
router.get('/today', async (req, res) => {
  const { staff_id, date } = req.query;
  const { data, error } = await supabase
    .from('staff_schedule')
    .select('shift_code')
    .eq('staff_id', staff_id)
    .eq('work_date', date)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/schedule/month?branch_id=xxx&month=2026-07-01
// 排班表整月資料：同仁清單（含部門分類）、當月已排班別、禁休日、規則設定
router.get('/month', async (req, res) => {
  const { branch_id, month } = req.query;
  const monthStart = month;
  const nextMonth = new Date(month);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const monthEnd = nextMonth.toISOString().slice(0, 10);

  try {
    const [staffRes, scheduleRes, blackoutRes, settingsRes] = await Promise.all([
      supabase.from('staff').select('id, name, roles!inner(name, category)').eq('branch_id', branch_id).eq('is_active', true).order('name'),
      supabase.from('staff_schedule').select('staff_id, work_date, shift_code').eq('branch_id', branch_id).gte('work_date', monthStart).lt('work_date', monthEnd),
      supabase.from('schedule_blackout_dates').select('date, note').eq('branch_id', branch_id).gte('date', monthStart).lt('date', monthEnd),
      supabase.from('schedule_settings').select('*').eq('branch_id', branch_id).eq('month', monthStart).maybeSingle(),
    ]);

    if (staffRes.error) throw staffRes.error;
    if (scheduleRes.error) throw scheduleRes.error;
    if (blackoutRes.error) throw blackoutRes.error;

    res.json({
      staff: staffRes.data,
      schedule: scheduleRes.data,
      blackout_dates: (blackoutRes.data || []).map((b) => b.date),
      settings: settingsRes.data || { target_off_days: 11, min_staff_frontdesk: 3, min_staff_housekeeping: 3 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedule/save
// { branch_id, month, entries: [{staff_id, work_date, shift_code}], blackout_dates: ["2026-07-04", ...], settings: {...} }
router.post('/save', async (req, res) => {
  const { branch_id, month, entries, blackout_dates, settings } = req.body;

  try {
    if (Array.isArray(entries) && entries.length > 0) {
      const rows = entries.map((e) => ({ ...e, branch_id }));
      const { error } = await supabase.from('staff_schedule').upsert(rows, { onConflict: 'staff_id,work_date' });
      if (error) throw error;
    }

    if (Array.isArray(blackout_dates)) {
      await supabase.from('schedule_blackout_dates').delete().eq('branch_id', branch_id).gte('date', month);
      if (blackout_dates.length > 0) {
        const rows = blackout_dates.map((d) => ({ branch_id, date: d }));
        const { error } = await supabase.from('schedule_blackout_dates').upsert(rows, { onConflict: 'branch_id,date' });
        if (error) throw error;
      }
    }

    if (settings) {
      const { error } = await supabase
        .from('schedule_settings')
        .upsert({ branch_id, month, ...settings }, { onConflict: 'branch_id,month' });
      if (error) throw error;
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
