import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// POST /api/room-cleanings/assign  { room_id, staff_id, work_date }
// 小隊長分配房號給房務同仁（建立當日待清潔紀錄）
router.post('/assign', async (req, res) => {
  const { room_id, staff_id, work_date } = req.body;
  const { data, error } = await supabase
    .from('room_cleanings')
    .upsert(
      { room_id, cleaned_by: staff_id, work_date, status: 'pending' },
      { onConflict: 'room_id,work_date' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/room-cleanings/assign-batch
// { branch_id, work_date, assignments: [{ room_id, staff_id }, ...] }
// 小隊長：分配當天房號。已經標記「完成」的房間不會被這支 API 動到
// （避免小隊長追加分配新房號時，把同仁已經打卡完成的房間洗回「待完成」，
//  導致同仁被迫重新按一次完成、記錄到錯誤的完成時間）
router.post('/assign-batch', async (req, res) => {
  const { work_date, assignments } = req.body;
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: '沒有分配任何房號' });
  }

  const roomIds = assignments.map((a) => a.room_id);
  const { data: existing, error: existingErr } = await supabase
    .from('room_cleanings')
    .select('room_id, status')
    .eq('work_date', work_date)
    .in('room_id', roomIds);
  if (existingErr) return res.status(400).json({ error: existingErr.message });

  const completedRoomIds = new Set((existing ?? []).filter((r) => r.status === 'completed').map((r) => r.room_id));

  const rows = assignments
    .filter((a) => !completedRoomIds.has(a.room_id)) // 已完成的房間跳過，不去動它
    .map((a) => ({
      room_id: a.room_id,
      cleaned_by: a.staff_id,
      work_date,
      status: 'pending',
    }));

  if (rows.length === 0) return res.json([]); // 全部都已完成，沒有需要異動的

  const { data, error } = await supabase
    .from('room_cleanings')
    .upsert(rows, { onConflict: 'room_id,work_date' })
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/room-cleanings/assignments?branch_id=xxx&date=2026-07-27
// 小隊長：查看當天已分配的狀況（含未分配房號清單，由前端跟 /api/rooms 比對）
router.get('/assignments', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('room_cleanings')
    .select('id, room_id, status, rooms!inner(room_number, floor, is_large, branch_id), staff:cleaned_by(id, name)')
    .eq('work_date', date)
    .eq('rooms.branch_id', branch_id);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/room-cleanings/mine?staff_id=xxx&date=2026-07-27
// 房務同仁：今日負責的房號清單
router.get('/mine', async (req, res) => {
  const { staff_id, date } = req.query;
  const { data, error } = await supabase
    .from('room_cleanings')
    .select('id, status, has_defect, defect_resolved, defect_note, completed_at, rooms(room_number, is_large, floor)')
    .eq('cleaned_by', staff_id)
    .eq('work_date', date)
    .order('id');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/room-cleanings/:id/complete  { completed_before_deadline, notes }
// 房務同仁標記房間完成
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { completed_before_deadline, notes } = req.body;

  const { data, error } = await supabase
    .from('room_cleanings')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_before_deadline,
      notes,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/room-cleanings/pending-inspection?branch_id=xxx&date=2026-07-27
// 客務C班：今日已完成、尚未巡房檢查的房號
router.get('/pending-inspection', async (req, res) => {
  const { branch_id, date } = req.query;
  const { data, error } = await supabase
    .from('room_cleanings')
    .select('id, completed_at, rooms!inner(room_number, is_large, branch_id), staff:cleaned_by(name)')
    .eq('work_date', date)
    .eq('status', 'completed')
    .is('checked_by', null)
    .eq('rooms.branch_id', branch_id);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/room-cleanings/:id/inspect
// { checked_by, has_defect, defect_note, defect_photo_url }
// 客務C班：巡房檢查結果（正常 or 回報缺失）
router.post('/:id/inspect', async (req, res) => {
  const { id } = req.params;
  const { checked_by, has_defect, defect_note, defect_photo_url } = req.body;

  const { data, error } = await supabase
    .from('room_cleanings')
    .update({
      checked_by,
      checked_at: new Date().toISOString(),
      has_defect: !!has_defect,
      defect_note: has_defect ? defect_note : null,
      defect_photo_url: has_defect ? defect_photo_url : null,
    })
    .eq('id', id)
    .select('*, rooms(id, room_number, branch_id)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // 有缺失同步寫入統一缺失回報表，方便之後做異常趨勢分析
  if (has_defect) {
    await supabase.from('defect_logs').insert({
      branch_id: req.body.branch_id ?? data.rooms?.branch_id ?? null,
      source_type: 'room',
      source_id: id,
      reported_by: checked_by,
      description: defect_note,
      photo_url: defect_photo_url,
    });

    // 檢查這間房最近是不是反覆出問題，是的話自動產生系統異常警示
    await checkRoomRepeatAnomaly(data.rooms, req.body.branch_id ?? data.rooms?.branch_id);
  }

  res.json(data);
});

// 同一間房在 30 天內累積到門檻次數（預設 3 次），自動產生一筆系統偵測異常
// 已經有一筆未處理的同類型異常時不會重複產生，避免洗版
async function checkRoomRepeatAnomaly(room, branchId) {
  if (!room?.id) return;
  const THRESHOLD = 3;
  const WINDOW_DAYS = 30;

  const { data: cleaningsForRoom } = await supabase
    .from('room_cleanings')
    .select('id')
    .eq('room_id', room.id);
  const cleaningIds = (cleaningsForRoom ?? []).map((c) => c.id);
  if (cleaningIds.length === 0) return;

  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const { count } = await supabase
    .from('defect_logs')
    .select('id', { count: 'exact', head: true })
    .eq('source_type', 'room')
    .in('source_id', cleaningIds)
    .gte('reported_at', since.toISOString());

  if ((count ?? 0) < THRESHOLD) return;

  const { data: existing } = await supabase
    .from('anomaly_logs')
    .select('id')
    .eq('type', 'repeat_defect_room')
    .eq('related_source_id', room.id)
    .eq('resolved', false)
    .maybeSingle();

  if (existing) return; // 已經有一筆待處理的了，不重複產生

  await supabase.from('anomaly_logs').insert({
    branch_id: branchId,
    type: 'repeat_defect_room',
    related_source_type: 'room',
    related_source_id: room.id,
    description: `${room.room_number} 房近${WINDOW_DAYS}天已累積 ${count} 次異常回報，建議安排檢查根本原因`,
  });
}

// POST /api/room-cleanings/:id/resolve-defect
// 房務同仁：缺失已經處理好了（例如補了毛巾），標記解決
// 同步把 room_cleanings 跟對應的 defect_logs 都標記，兩邊資料才會一致
router.post('/:id/resolve-defect', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('room_cleanings')
    .update({ defect_resolved: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabase
    .from('defect_logs')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('source_type', 'room')
    .eq('source_id', id)
    .eq('resolved', false);

  res.json(data);
});

export default router;
