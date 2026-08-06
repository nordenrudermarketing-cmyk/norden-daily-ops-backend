import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/written-exam/questions?branch_id=xxx
router.get('/questions', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('written_exam_questions')
    .select('*')
    .eq('branch_id', branch_id)
    .order('section')
    .order('sort_order');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/written-exam/results?staff_id=xxx
router.get('/results', async (req, res) => {
  const { staff_id } = req.query;
  const { data, error } = await supabase
    .from('written_exam_results')
    .select('*')
    .eq('staff_id', staff_id)
    .order('exam_date', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/written-exam/results
router.post('/results', async (req, res) => {
  const { data, error } = await supabase.from('written_exam_results').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
