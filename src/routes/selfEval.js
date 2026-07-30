import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// 職務類別 -> 自評題目類別對照（除了共同題目外，額外要加的專屬題目類別）
const ROLE_CATEGORY_MAP = { housekeeping: 'housekeeping', frontdesk: 'frontdesk', management: 'management', headquarters: 'management' };

function prevMonthFirstDay(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return d.toISOString().slice(0, 10);
}

// ---------- 題目範本管理（總公司用）----------

// GET /api/self-eval/templates?category=xxx(選填)
router.get('/templates', async (req, res) => {
  const { category } = req.query;
  let query = supabase.from('self_eval_templates').select('*').order('category').order('sort_order');
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/self-eval/templates  { category, question_zh, question_id, sort_order }
router.post('/templates', async (req, res) => {
  const { data, error } = await supabase.from('self_eval_templates').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// PUT /api/self-eval/templates/:id
router.put('/templates/:id', async (req, res) => {
  const { id } = req.params;
  const { category, question_zh, question_id, sort_order } = req.body;
  const { data, error } = await supabase
    .from('self_eval_templates')
    .update({ category, question_zh, question_id, sort_order })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/self-eval/templates/:id/toggle  { is_active }
router.post('/templates/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  const { data, error } = await supabase.from('self_eval_templates').update({ is_active }).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------- 同仁填寫自評表 ----------

// GET /api/self-eval/form?staff_id=xxx&eval_month=2026-07-01（選填，預設上個月）
router.get('/form', async (req, res) => {
  const { staff_id } = req.query;
  const evalMonth = req.query.eval_month || prevMonthFirstDay();

  const { data: staffRow, error: staffErr } = await supabase
    .from('staff')
    .select('id, name, branch_id, roles(category)')
    .eq('id', staff_id)
    .single();
  if (staffErr) return res.status(400).json({ error: staffErr.message });

  const roleCategory = ROLE_CATEGORY_MAP[staffRow.roles?.category] || null;
  const categories = roleCategory ? ['common', roleCategory] : ['common'];

  const { data: templates, error: tplErr } = await supabase
    .from('self_eval_templates')
    .select('*')
    .in('category', categories)
    .eq('is_active', true)
    .order('category')
    .order('sort_order');
  if (tplErr) return res.status(400).json({ error: tplErr.message });

  const { data: submission } = await supabase
    .from('self_eval_submissions')
    .select('*')
    .eq('staff_id', staff_id)
    .eq('eval_month', evalMonth)
    .maybeSingle();

  let answers = [];
  if (submission) {
    const { data } = await supabase.from('self_eval_answers').select('*').eq('submission_id', submission.id);
    answers = data ?? [];
  }
  const answerMap = {};
  answers.forEach((a) => { answerMap[a.template_id] = a; });

  const dueMonth = new Date(evalMonth);
  dueMonth.setMonth(dueMonth.getMonth() + 1);
  const actualDueDate = `${dueMonth.toISOString().slice(0, 8)}10`;

  res.json({
    staff: { id: staffRow.id, name: staffRow.name, branch_id: staffRow.branch_id },
    eval_month: evalMonth,
    due_date: actualDueDate,
    submission: submission || null,
    questions: templates.map((t) => ({ ...t, answer: answerMap[t.id] || null })),
  });
});

// POST /api/self-eval/save
// { staff_id, branch_id, eval_month, answers: [{template_id, staff_answer, staff_note}], submit: true/false }
router.post('/save', async (req, res) => {
  const { staff_id, branch_id, eval_month, answers, submit } = req.body;

  const dueMonth = new Date(eval_month);
  dueMonth.setMonth(dueMonth.getMonth() + 1);
  const dueDate = `${dueMonth.toISOString().slice(0, 8)}10`;

  const { data: submission, error: subErr } = await supabase
    .from('self_eval_submissions')
    .upsert(
      {
        staff_id, branch_id, eval_month,
        status: submit ? 'submitted' : 'draft',
        due_date: dueDate,
        submitted_at: submit ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'staff_id,eval_month' }
    )
    .select()
    .single();
  if (subErr) return res.status(400).json({ error: subErr.message });

  if (Array.isArray(answers) && answers.length > 0) {
    const rows = answers.map((a) => ({ submission_id: submission.id, ...a }));
    const { error: ansErr } = await supabase.from('self_eval_answers').upsert(rows, { onConflict: 'submission_id,template_id' });
    if (ansErr) return res.status(400).json({ error: ansErr.message });
  }

  res.json(submission);
});

// ---------- 店經理審閱 ----------

// GET /api/self-eval/branch-overview?branch_id=xxx&eval_month=2026-07-01
router.get('/branch-overview', async (req, res) => {
  const { branch_id } = req.query;
  const evalMonth = req.query.eval_month || prevMonthFirstDay();

  const { data: staffList, error: staffErr } = await supabase
    .from('staff')
    .select('id, name, roles(name)')
    .eq('branch_id', branch_id)
    .eq('is_active', true);
  if (staffErr) return res.status(400).json({ error: staffErr.message });

  const { data: submissions } = await supabase
    .from('self_eval_submissions')
    .select('id, staff_id, status, submitted_at, due_date')
    .eq('branch_id', branch_id)
    .eq('eval_month', evalMonth);

  const subMap = {};
  (submissions ?? []).forEach((s) => { subMap[s.staff_id] = s; });

  res.json(staffList.map((s) => ({
    staff_id: s.id,
    name: s.name,
    role_name: s.roles?.name,
    submission: subMap[s.id] || null,
  })));
});

// GET /api/self-eval/submission-detail?submission_id=xxx
router.get('/submission-detail', async (req, res) => {
  const { submission_id } = req.query;

  const { data: submission, error } = await supabase
    .from('self_eval_submissions')
    .select('*, staff:staff_id(name)')
    .eq('id', submission_id)
    .single();
  if (error) return res.status(400).json({ error: error.message });

  const { data: answers } = await supabase
    .from('self_eval_answers')
    .select('*, template:template_id(category, question_zh, question_id, sort_order)')
    .eq('submission_id', submission_id);

  const sorted = (answers ?? []).sort((a, b) => (a.template?.sort_order ?? 0) - (b.template?.sort_order ?? 0));

  res.json({ submission, answers: sorted });
});

// POST /api/self-eval/manager-review
// { submission_id, answers: [{template_id, manager_answer, manager_note}], interview_notes, interview_date, mark_reviewed }
router.post('/manager-review', async (req, res) => {
  const { submission_id, answers, interview_notes, interview_date, mark_reviewed } = req.body;

  if (Array.isArray(answers)) {
    for (const a of answers) {
      await supabase
        .from('self_eval_answers')
        .update({ manager_answer: a.manager_answer, manager_note: a.manager_note })
        .eq('submission_id', submission_id)
        .eq('template_id', a.template_id);
    }
  }

  const updatePayload = { manager_interview_notes: interview_notes, interview_date, updated_at: new Date().toISOString() };
  if (mark_reviewed) {
    updatePayload.status = 'reviewed';
    updatePayload.manager_signed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('self_eval_submissions')
    .update(updatePayload)
    .eq('id', submission_id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
