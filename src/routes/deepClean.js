import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/deep-clean/floor-owners?branch_id=xxx
// 目前生效中的樓主指派（依樓層）
router.get('/floor-owners', async (req, res) => {
  const { branch_id } = req.query;
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('floor_owners')
    .select('id, floor, staff:staff_id(id, name), period_start, period_end')
    .eq('branch_id', branch_id)
    .lte('period_start', today)
    .or(`period_end.is.null,period_end.gte.${today}`)
    .order('floor');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/deep-clean/floor-owners  { branch_id, floor, staff_id }
// 設定/更新某樓層的樓主（本期，from 本月1號起生效）
router.post('/floor-owners', async (req, res) => {
  const { branch_id, floor, staff_id } = req.body;
  const periodStart = new Date().toISOString().slice(0, 7) + '-01';

  const { data, error } = await supabase
    .from('floor_owners')
    .upsert(
      { branch_id, floor, staff_id, period_start: periodStart, period_end: null },
      { onConflict: 'branch_id,floor,period_start' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/deep-clean/templates?branch_id=xxx
router.get('/templates', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('deep_clean_task_templates')
    .select('id, scope, floor, task_name, special_month_note, sort_order')
    .eq('branch_id', branch_id)
    .order('sort_order');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/deep-clean/month?branch_id=xxx&month=2026-07-01
router.get('/month', async (req, res) => {
  const { branch_id, month } = req.query;
  const { data, error } = await supabase
    .from('deep_clean_assignments')
    .select('id, week_number, status, scheduled_date, completed_date, template:template_id(task_name, floor, scope), owner:owner_staff_id(id, name)')
    .eq('branch_id', branch_id)
    .eq('month', month)
    .order('week_number');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/deep-clean/generate
// { branch_id, month, floor_weeks: { "8": 1, "9": 2, "10": 3, "11": 4, "12": 1 } }
// 依樓層對應週次＋當前樓主，補齊本月還沒建立的排程（不會覆蓋已存在的，避免洗掉已完成紀錄）
router.post('/generate', async (req, res) => {
  const { branch_id, month, floor_weeks } = req.body;

  const { data: templates, error: templateErr } = await supabase
    .from('deep_clean_task_templates')
    .select('id, floor')
    .eq('branch_id', branch_id)
    .not('floor', 'is', null);
  if (templateErr) return res.status(400).json({ error: templateErr.message });

  const { data: existing, error: existingErr } = await supabase
    .from('deep_clean_assignments')
    .select('template_id')
    .eq('branch_id', branch_id)
    .eq('month', month);
  if (existingErr) return res.status(400).json({ error: existingErr.message });
  const existingTemplateIds = new Set((existing ?? []).map((e) => e.template_id));

  const { data: owners, error: ownerErr } = await supabase
    .from('floor_owners')
    .select('floor, staff_id')
    .eq('branch_id', branch_id);
  if (ownerErr) return res.status(400).json({ error: ownerErr.message });
  const ownerByFloor = {};
  (owners ?? []).forEach((o) => { ownerByFloor[o.floor] = o.staff_id; });

  const toInsert = templates
    .filter((t) => !existingTemplateIds.has(t.id))
    .map((t) => ({
      template_id: t.id,
      branch_id,
      month,
      week_number: floor_weeks[String(t.floor)] || 1,
      owner_staff_id: ownerByFloor[t.floor] || null,
      status: 'pending',
    }));

  if (toInsert.length === 0) return res.json({ inserted: 0 });

  const { error: insertErr } = await supabase.from('deep_clean_assignments').insert(toInsert);
  if (insertErr) return res.status(400).json({ error: insertErr.message });
  res.json({ inserted: toInsert.length });
});

// POST /api/deep-clean/:id/complete  { checked_by }
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { checked_by } = req.body;

  const { data, error } = await supabase
    .from('deep_clean_assignments')
    .update({
      status: 'completed',
      completed_date: new Date().toISOString().slice(0, 10),
      checked_by,
      checked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
