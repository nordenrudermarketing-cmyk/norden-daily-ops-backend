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

// POST /api/written-exam/attempts/start  { staff_id, branch_id }
// 開始一次測驗：帶回題目（不含正確答案，避免被看到）
router.post('/attempts/start', async (req, res) => {
  const { staff_id, branch_id } = req.body;

  const { data: attempt, error: attemptErr } = await supabase
    .from('written_exam_attempts')
    .insert({ staff_id, branch_id, time_limit_minutes: 40, status: 'in_progress' })
    .select()
    .single();
  if (attemptErr) return res.status(400).json({ error: attemptErr.message });

  const { data: questions, error: qErr } = await supabase
    .from('written_exam_questions')
    .select('id, section, question_number, question_text, options_text, sort_order')
    .eq('branch_id', branch_id)
    .order('section')
    .order('sort_order');
  if (qErr) return res.status(400).json({ error: qErr.message });

  res.json({ attempt, questions });
});

// POST /api/written-exam/attempts/:id/submit
// { answers: [{ question_id, answer_text }] }
// 自動改「有標準答案」的題目（選擇題），其餘（是非/問答）只存答案不判分
router.post('/attempts/:id/submit', async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;
  if (!Array.isArray(answers)) return res.status(400).json({ error: '缺少作答內容' });

  const questionIds = answers.map((a) => a.question_id);
  const { data: questions } = await supabase
    .from('written_exam_questions')
    .select('id, correct_answer')
    .in('id', questionIds);

  const answerMap = {};
  questions.forEach((q) => { answerMap[q.id] = q.correct_answer; });

  let correctCount = 0;
  let totalScored = 0;
  const rows = answers.map((a) => {
    const correctAnswer = answerMap[a.question_id];
    let isCorrect = null;
    if (correctAnswer) {
      totalScored += 1;
      isCorrect = String(a.answer_text || '').trim().toUpperCase() === String(correctAnswer).trim().toUpperCase();
      if (isCorrect) correctCount += 1;
    }
    return { attempt_id: id, question_id: a.question_id, answer_text: a.answer_text, is_correct: isCorrect };
  });

  const { error: insErr } = await supabase.from('written_exam_answers').insert(rows);
  if (insErr) return res.status(400).json({ error: insErr.message });

  const wrongCount = totalScored - correctCount;
  const passed = totalScored > 0 ? correctCount / totalScored >= 0.75 : null;

  const { data: attempt, error: updErr } = await supabase
    .from('written_exam_attempts')
    .update({ submitted_at: new Date().toISOString(), correct_count: correctCount, wrong_count: wrongCount, total_scored: totalScored, passed, status: 'submitted' })
    .eq('id', id)
    .select()
    .single();
  if (updErr) return res.status(400).json({ error: updErr.message });

  // 只回傳對錯題數跟有沒有通過，不會揭曉哪一題答案是什麼
  res.json(attempt);
});

// GET /api/written-exam/attempts?staff_id=xxx
router.get('/attempts', async (req, res) => {
  const { staff_id } = req.query;
  const { data, error } = await supabase
    .from('written_exam_attempts')
    .select('*')
    .eq('staff_id', staff_id)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/written-exam/attempts/:id/detail  給店經理審閱用，含正確答案跟問答題參考答案
router.get('/attempts/:id/detail', async (req, res) => {
  const { id } = req.params;
  const { data: attempt, error: attemptErr } = await supabase
    .from('written_exam_attempts')
    .select('*, staff:staff_id(name)')
    .eq('id', id)
    .single();
  if (attemptErr) return res.status(400).json({ error: attemptErr.message });

  const { data: answers, error: ansErr } = await supabase
    .from('written_exam_answers')
    .select('*, question:question_id(section, question_number, question_text, options_text, correct_answer, reference_answer)')
    .eq('attempt_id', id);
  if (ansErr) return res.status(400).json({ error: ansErr.message });

  res.json({ attempt, answers });
});

export default router;
