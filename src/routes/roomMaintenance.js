import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/room-maintenance/zone-owners?branch_id=xxx
router.get('/zone-owners', async (req, res) => {
  const { branch_id } = req.query;
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('zone_owners')
    .select('id, zone, staff:staff_id(id, name), period_start, period_end')
    .eq('branch_id', branch_id)
    .lte('period_start', today)
    .or(`period_end.is.null,period_end.gte.${today}`)
    .order('zone');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/room-maintenance/zone-owners  { branch_id, zone, staff_id }
router.post('/zone-owners', async (req, res) => {
  const { branch_id, zone, staff_id } = req.body;
  const periodStart = new Date().toISOString().slice(0, 7) + '-01';

  const { data, error } = await supabase
    .from('zone_owners')
    .upsert(
      { branch_id, zone, staff_id, period_start: periodStart, period_end: null },
      { onConflict: 'branch_id,zone,period_start' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/room-maintenance/zones?branch_id=xxx  --列出這個館有哪些責任區代碼
router.get('/zones', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('rooms')
    .select('zone')
    .eq('branch_id', branch_id)
    .not('zone', 'is', null);
  if (error) return res.status(400).json({ error: error.message });
  res.json([...new Set((data ?? []).map((r) => r.zone))].sort());
});

// GET /api/room-maintenance/month?branch_id=xxx&month=2026-07-01&zone=A
// 該責任區、該月，所有房間 x 所有適用任務（含當季適用的季清項目）的完成狀況
router.get('/month', async (req, res) => {
  const { branch_id, month, zone } = req.query;
  const monthNum = Number(month.slice(5, 7));
  const quarterGroup = ((monthNum - 1) % 3) + 1; // 1,4,7,10->1 / 2,5,8,11->2 / 3,6,9,12->3

  try {
    const [roomsRes, templatesRes] = await Promise.all([
      supabase.from('rooms').select('id, room_number, is_large').eq('branch_id', branch_id).eq('zone', zone).eq('is_active', true).order('room_number'),
      supabase.from('room_maintenance_templates').select('*').eq('branch_id', branch_id).order('sort_order'),
    ]);
    if (roomsRes.error) throw roomsRes.error;
    if (templatesRes.error) throw templatesRes.error;

    const applicableTemplates = (templatesRes.data ?? []).filter(
      (t) => t.cycle !== 'quarterly' || t.quarter_group === quarterGroup
    );

    const roomIds = roomsRes.data.map((r) => r.id);
    const templateIds = applicableTemplates.map((t) => t.id);

    const { data: completions, error: compErr } = await supabase
      .from('room_maintenance_completions')
      .select('id, template_id, room_id, status, completed_date, checked_by')
      .eq('month', month)
      .in('room_id', roomIds.length ? roomIds : ['00000000-0000-0000-0000-000000000000'])
      .in('template_id', templateIds.length ? templateIds : ['00000000-0000-0000-0000-000000000000']);
    if (compErr) throw compErr;

    const compMap = {};
    (completions ?? []).forEach((c) => { compMap[`${c.template_id}_${c.room_id}`] = c; });

    res.json({ rooms: roomsRes.data, templates: applicableTemplates, completions: compMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/room-maintenance/generate  { branch_id, month }
// 幫所有責任區、所有房間，補齊這個月適用任務的紀錄（已存在的不會重複產生，不會洗掉已完成的）
router.post('/generate', async (req, res) => {
  const { branch_id, month } = req.body;
  const monthNum = Number(month.slice(5, 7));
  const quarterGroup = ((monthNum - 1) % 3) + 1;

  try {
    const [roomsRes, templatesRes, existingRes] = await Promise.all([
      supabase.from('rooms').select('id').eq('branch_id', branch_id).not('zone', 'is', null).eq('is_active', true),
      supabase.from('room_maintenance_templates').select('id, cycle, quarter_group').eq('branch_id', branch_id),
      supabase.from('room_maintenance_completions').select('template_id, room_id').eq('month', month),
    ]);
    if (roomsRes.error) throw roomsRes.error;
    if (templatesRes.error) throw templatesRes.error;

    const applicableTemplates = (templatesRes.data ?? []).filter(
      (t) => t.cycle !== 'quarterly' || t.quarter_group === quarterGroup
    );

    const existingSet = new Set((existingRes.data ?? []).map((e) => `${e.template_id}_${e.room_id}`));

    const rows = [];
    for (const room of roomsRes.data) {
      for (const t of applicableTemplates) {
        const key = `${t.id}_${room.id}`;
        if (!existingSet.has(key)) {
          rows.push({ template_id: t.id, room_id: room.id, month, status: 'pending' });
        }
      }
    }

    // 分批寫入，避免一次塞太多筆
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        const { error } = await supabase.from('room_maintenance_completions').insert(chunk);
        if (error) throw error;
      }
    }

    res.json({ inserted: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/room-maintenance/:id/complete  { staff_id }
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { staff_id } = req.body;

  const { data, error } = await supabase
    .from('room_maintenance_completions')
    .update({
      status: 'completed',
      completed_date: new Date().toISOString().slice(0, 10),
      completed_by: staff_id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/room-maintenance/paint?branch_id=xxx&zone=A
router.get('/paint', async (req, res) => {
  const { branch_id, zone } = req.query;
  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('id, room_number')
    .eq('branch_id', branch_id)
    .eq('zone', zone)
    .eq('is_active', true)
    .order('room_number');
  if (roomErr) return res.status(400).json({ error: roomErr.message });

  const roomIds = rooms.map((r) => r.id);
  const { data: paints } = await supabase
    .from('paint_inspections')
    .select('*')
    .in('room_id', roomIds.length ? roomIds : ['00000000-0000-0000-0000-000000000000']);

  const paintMap = {};
  (paints ?? []).forEach((p) => { paintMap[p.room_id] = p; });

  res.json(rooms.map((r) => ({ ...r, paint: paintMap[r.id] || null })));
});

// POST /api/room-maintenance/paint  { room_id, status, note, staff_id }
router.post('/paint', async (req, res) => {
  const { room_id, status, note, staff_id } = req.body;
  const { data, error } = await supabase
    .from('paint_inspections')
    .upsert(
      { room_id, status, note, updated_by: staff_id, updated_at: new Date().toISOString() },
      { onConflict: 'room_id' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
