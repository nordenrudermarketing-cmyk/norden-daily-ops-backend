import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/training/progress?staff_id=xxx&category=housekeeping&branch_id=xxx
// 該同仁在該職務學習地圖上的完整進度（每一項訓練項目 + 目前進度）
// 學習地圖是分館別的（台中館跟台東1館的房務學習內容不一樣），一定要帶 branch_id
router.get('/progress', async (req, res) => {
  const { staff_id, category, branch_id } = req.query;

  let pathQuery = supabase.from('learning_paths').select('id, name').eq('category', category);
  if (branch_id) pathQuery = pathQuery.eq('branch_id', branch_id);
  const { data: path, error: pathErr } = await pathQuery.maybeSingle();
  if (pathErr) return res.status(400).json({ error: pathErr.message });
  if (!path) return res.json({ path: null, units: [] });

  const { data: units, error: unitErr } = await supabase
    .from('learning_units')
    .select('id, topic, category, item_name, item_name_id, sort_order')
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

// ---------- 教學指派制 ----------

// GET /api/training/assign-list?branch_id=xxx&category=housekeeping&trainee_id=xxx
// 店經理指派頁用：該類別全部學習項目，附上這位新人目前每項指派給誰教、教了沒
router.get('/assign-list', async (req, res) => {
  const { branch_id, category, trainee_id } = req.query;

  const { data: path } = await supabase
    .from('learning_paths')
    .select('id')
    .eq('branch_id', branch_id)
    .eq('category', category)
    .maybeSingle();
  if (!path) return res.json([]);

  const { data: units } = await supabase
    .from('learning_units')
    .select('id, topic, category, item_name, sort_order')
    .eq('path_id', path.id)
    .eq('is_active', true)
    .order('sort_order');

  const unitIds = (units ?? []).map((u) => u.id);
  const { data: assignments } = await supabase
    .from('learning_unit_assignments')
    .select('*, trainer:trainer_id(name)')
    .eq('trainee_id', trainee_id)
    .in('unit_id', unitIds.length ? unitIds : ['00000000-0000-0000-0000-000000000000']);

  const assignMap = {};
  (assignments ?? []).forEach((a) => { assignMap[a.unit_id] = a; });

  res.json((units ?? []).map((u) => ({ ...u, assignment: assignMap[u.id] || null })));
});

// POST /api/training/assign
// { unit_id, trainee_id, trainer_id, assigned_by }
router.post('/assign', async (req, res) => {
  const { unit_id, trainee_id, trainer_id, assigned_by } = req.body;
  const { data, error } = await supabase
    .from('learning_unit_assignments')
    .upsert(
      { unit_id, trainee_id, trainer_id, assigned_by, status: 'pending' },
      { onConflict: 'unit_id,trainee_id' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/training/my-teaching?trainer_id=xxx
// 教練用自己帳號查看：分配給我、還沒完成的教學任務
router.get('/my-teaching', async (req, res) => {
  const { trainer_id } = req.query;
  const { data, error } = await supabase
    .from('learning_unit_assignments')
    .select('*, unit:unit_id(topic, category, item_name), trainee:trainee_id(name)')
    .eq('trainer_id', trainer_id)
    .eq('status', 'pending')
    .order('assigned_at');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/training/teaching-complete
// { assignment_id, trainer_id, trainer_name, result, notes }
// 教練標記完成教學＋驗收結果，這筆資料只有教練自己能操作（用自己的登入帳號）
router.post('/teaching-complete', async (req, res) => {
  const { assignment_id, trainer_id, trainer_name, result, notes } = req.body;

  const { data: assignment, error: findErr } = await supabase
    .from('learning_unit_assignments')
    .select('unit_id, trainee_id')
    .eq('id', assignment_id)
    .single();
  if (findErr) return res.status(400).json({ error: findErr.message });

  await supabase
    .from('learning_unit_assignments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', assignment_id);

  const { data, error } = await supabase
    .from('staff_learning_progress')
    .upsert(
      {
        staff_id: assignment.trainee_id,
        unit_id: assignment.unit_id,
        trainer_name,
        taught_date: new Date().toISOString().slice(0, 10),
        result,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'staff_id,unit_id' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
