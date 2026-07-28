import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// POST /api/issues/report
// { branch_id, source_type, source_id, source_label, reported_by, description, photo_url }
// 通用回報：房務任務、客務班別任務、細清任務都可以呼叫同一支
// source_label 是給交班表顯示用的可讀名稱（例如任務名稱），不影響資料庫關聯
router.post('/report', async (req, res) => {
  const { branch_id, source_type, source_id, source_label, reported_by, description, photo_url } = req.body;
  if (!description) return res.status(400).json({ error: '請填寫回報說明' });

  const { data, error } = await supabase
    .from('defect_logs')
    .insert({
      branch_id,
      source_type,
      source_id,
      reported_by,
      description: source_label ? `【${source_label}】${description}` : description,
      photo_url: photo_url || null,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/issues/list?branch_id=xxx&resolved=false&source_type=room
// 給管理頁用：異常/問題總清單，可篩選處理狀態跟來源
router.get('/list', async (req, res) => {
  const { branch_id, resolved, source_type } = req.query;

  let query = supabase
    .from('defect_logs')
    .select('id, source_type, source_id, description, photo_url, reported_at, resolved, resolved_at, staff:reported_by(name)')
    .eq('branch_id', branch_id)
    .order('reported_at', { ascending: false });

  if (resolved !== undefined) query = query.eq('resolved', resolved === 'true');
  if (source_type) query = query.eq('source_type', source_type);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  // 房號類的來源，補上實際房號（source_id 指向 room_cleanings，不是房間本身）
  const roomSourceIds = data.filter((d) => d.source_type === 'room').map((d) => d.source_id);
  let roomLabels = {};
  if (roomSourceIds.length > 0) {
    const { data: cleanings } = await supabase
      .from('room_cleanings')
      .select('id, rooms(room_number)')
      .in('id', roomSourceIds);
    (cleanings ?? []).forEach((c) => { roomLabels[c.id] = c.rooms?.room_number; });
  }

  const result = data.map((d) => ({
    ...d,
    location_label: d.source_type === 'room' ? roomLabels[d.source_id] : null,
  }));

  res.json(result);
});

// POST /api/issues/:id/resolve
router.post('/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('defect_logs')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/issues/room-trends?branch_id=xxx&days=30
// 依房號統計缺失次數，抓出「同一間房重複出問題」的房號
router.get('/room-trends', async (req, res) => {
  const { branch_id, days } = req.query;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - Number(days || 30));
  const since = sinceDate.toISOString();

  const { data: defects, error } = await supabase
    .from('defect_logs')
    .select('id, source_id, description, reported_at')
    .eq('branch_id', branch_id)
    .eq('source_type', 'room')
    .gte('reported_at', since)
    .order('reported_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  if (!defects || defects.length === 0) return res.json([]);

  const sourceIds = defects.map((d) => d.source_id);
  const { data: cleanings } = await supabase
    .from('room_cleanings')
    .select('id, rooms(room_number)')
    .in('id', sourceIds);

  const roomByCleaningId = {};
  (cleanings ?? []).forEach((c) => { roomByCleaningId[c.id] = c.rooms?.room_number || '未知房號'; });

  const grouped = {};
  defects.forEach((d) => {
    const room = roomByCleaningId[d.source_id] || '未知房號';
    grouped[room] = grouped[room] || [];
    grouped[room].push({ description: d.description, reported_at: d.reported_at });
  });

  const result = Object.entries(grouped)
    .map(([room_number, items]) => ({ room_number, count: items.length, items }))
    .sort((a, b) => b.count - a.count);

  res.json(result);
});

export default router;
