import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/training/progress?staff_id=xxx&category=housekeeping
// 該同仁在該職務學習地圖上的完整進度（每一項訓練項目 + 目前進度）
router.get('/progress', async (req, res) => {
  const { staff_id, category } = req.query;

  const { data: path, error: pathErr } = await supabase
    .from('learning_paths')
    .select('id, name')
    .eq('category', category)
    .maybeSingle();
  if (pathErr) return res.status(400).json({ error: pathErr.message });
  if (!path) return res.json({ path: null, units: [] });

  const { data: units, error: unitErr } = await supabase
    .from('learning_units')
    .select('id, topic, category, item_name, sort_order')
    .eq('path_id', path.id)
    .eq('is_active', true)
    .order('sort_order');
  if (unitErr) return res.status(400).json({ error: unitErr.message });

  const { data: progress } = await supabase
    .from('staff_learning_progress')
    .select('*')
    .eq('staff_id', staff_id)
    .in('unit_id', units.map((u) => u.id));

  const progressByUnit = {};
  (progress ?? []).forEach((p) => { progressByUnit[p.unit_id] = p; });

  const result = units.map((u) => ({ ...u, progress: progressByUnit[u.id] || null }));
  res.json({ path, units: result });
});

// POST /api/training/progress
// { staff_id, unit_id, trainer_name, taught_date, result }
router.post('/progress', async (req, res) => {
  const { staff_id, unit_id, trainer_name, taught_date, result } = req.body;

  const { data, error } = await supabase
    .from('staff_learning_progress')
    .upsert(
      { staff_id, unit_id, trainer_name, taught_date, result, updated_at: new Date().toISOString() },
      { onConflict: 'staff_id,unit_id' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/training/exams?staff_id=xxx
router.get('/exams', async (req, res) => {
  const { staff_id } = req.query;
  const { data, error } = await supabase
    .from('practical_exams')
    .select('*')
    .eq('staff_id', staff_id)
    .order('assessed_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/training/exams
router.post('/exams', async (req, res) => {
  const payload = req.body;
  const { data, error } = await supabase
    .from('practical_exams')
    .insert({ ...payload, assessed_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
