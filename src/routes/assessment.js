import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

const STAGES = ['認識', '操作', '獨立', '穩定'];

// GET /api/assessment/stages?staff_id=xxx
// 固定回傳四個階段，沒評核過的階段用空殼帶出
router.get('/stages', async (req, res) => {
  const { staff_id } = req.query;

  const { data, error } = await supabase
    .from('assessment_stage_evaluations')
    .select('*')
    .eq('staff_id', staff_id);
  if (error) return res.status(400).json({ error: error.message });

  const byStage = {};
  (data ?? []).forEach((d) => { byStage[d.stage] = d; });

  const result = STAGES.map((stage) => byStage[stage] || { staff_id, stage, result: null, category_ratings: {} });
  res.json(result);
});

// POST /api/assessment/stages
// { staff_id, stage, evaluated_by, category_ratings, result, notes }
router.post('/stages', async (req, res) => {
  const { staff_id, stage, evaluated_by, category_ratings, result, notes } = req.body;

  const { data, error } = await supabase
    .from('assessment_stage_evaluations')
    .upsert(
      { staff_id, stage, evaluated_by, category_ratings, result, notes, evaluated_at: new Date().toISOString() },
      { onConflict: 'staff_id,stage' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
