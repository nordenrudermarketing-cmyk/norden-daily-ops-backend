import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/manager-worksheet/form?staff_id=xxx&date=2026-08-20
router.get('/form', async (req, res) => {
  const { staff_id, date } = req.query;
  const workDate = date || new Date().toISOString().slice(0, 10);

  const { data: templates, error: tplErr } = await supabase
    .from('manager_worksheet_templates')
    .select('*')
    .order('sort_order');
  if (tplErr) return res.status(400).json({ error: tplErr.message });

  const { data: submission } = await supabase
    .from('manager_worksheet_submissions')
    .select('*')
    .eq('staff_id', staff_id)
    .eq('work_date', workDate)
    .maybeSingle();

  let answers = [];
  if (submission) {
    const { data } = await supabase.from('manager_worksheet_answers').select('*').eq('submission_id', submission.id);
    answers = data ?? [];
  }
  const answerMap = {};
  answers.forEach((a) => { answerMap[a.template_id] = a; });

  res.json({
    work_date: workDate,
    submission: submission || null,
    items: templates.map((t) => ({ ...t, checked: answerMap[t.id]?.checked || false })),
  });
});

// POST /api/manager-worksheet/save
router.post('/save', async (req, res) => {
  const { staff_id, branch_id, work_date, checked_items, ...fields } = req.body;

  const { data: submission, error: subErr } = await supabase
    .from('manager_worksheet_submissions')
    .upsert(
      { staff_id, branch_id, work_date, ...fields, submitted_at: new Date().toISOString() },
      { onConflict: 'staff_id,work_date' }
    )
    .select()
    .single();
  if (subErr) return res.status(400).json({ error: subErr.message });

  if (Array.isArray(checked_items) && checked_items.length > 0) {
    const rows = checked_items.map((c) => ({ submission_id: submission.id, template_id: c.template_id, checked: c.checked }));
    const { error: ansErr } = await supabase.from('manager_worksheet_answers').upsert(rows, { onConflict: 'submission_id,template_id' });
    if (ansErr) return res.status(400).json({ error: ansErr.message });
  }

  res.json(submission);
});

// GET /api/manager-worksheet/has-submitted-today?staff_id=xxx&date=2026-08-20
router.get('/has-submitted-today', async (req, res) => {
  const { staff_id, date } = req.query;
  const workDate = date || new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('manager_worksheet_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('staff_id', staff_id)
    .eq('work_date', workDate);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ has_submitted: (count ?? 0) > 0 });
});

// GET /api/manager-worksheet/hq-list?date=2026-08-20  給總公司看三館當天交表狀況
router.get('/hq-list', async (req, res) => {
  const { date } = req.query;
  const workDate = date || new Date().toISOString().slice(0, 10);

  const { data: branches } = await supabase.from('branches').select('id, name').neq('code', 'HQ');
  const { data: submissions } = await supabase
    .from('manager_worksheet_submissions')
    .select('*, staff:staff_id(name)')
    .eq('work_date', workDate);

  const byBranch = {};
  (submissions ?? []).forEach((s) => {
    byBranch[s.branch_id] = byBranch[s.branch_id] || [];
    byBranch[s.branch_id].push(s);
  });

  res.json((branches ?? []).map((b) => ({ branch_id: b.id, branch_name: b.name, submissions: byBranch[b.id] || [] })));
});

// GET /api/manager-worksheet/:id/detail
router.get('/:id/detail', async (req, res) => {
  const { id } = req.params;
  const { data: submission, error: subErr } = await supabase
    .from('manager_worksheet_submissions')
    .select('*, staff:staff_id(name)')
    .eq('id', id)
    .single();
  if (subErr) return res.status(400).json({ error: subErr.message });

  const { data: answers } = await supabase
    .from('manager_worksheet_answers')
    .select('*, template:template_id(section, item_text, sort_order)')
    .eq('submission_id', id);

  const sorted = (answers ?? []).sort((a, b) => (a.template?.sort_order ?? 0) - (b.template?.sort_order ?? 0));
  res.json({ submission, answers: sorted });
});

export default router;
