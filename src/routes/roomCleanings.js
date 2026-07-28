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
// 小隊長：一次分配當天全部房號
router.post('/assign-batch', async (req, res) => {
  const { work_date, assignments } = req.body;
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: '沒有分配任何房號' });
  }

  const rows = assignments.map((a) => ({
    room_id: a.room_id,
    cleaned_by: a.staff_id,
    work_date,
    status: 'pending',
  }));

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
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // 有缺失同步寫入統一缺失回報表，方便之後做異常趨勢分析
  if (has_defect) {
    await supabase.from('defect_logs').insert({
      branch_id: req.body.branch_id ?? null,
      source_type: 'room',
      source_id: id,
      reported_by: checked_by,
      description: defect_note,
      photo_url: defect_photo_url,
    });
  }

  res.json(data);
});

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
