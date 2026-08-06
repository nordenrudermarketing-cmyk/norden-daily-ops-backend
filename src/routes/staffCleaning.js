import express from 'express';
import { supabase } from '../supabaseClient.js';
import { uploadPhotoIfBase64 } from '../lib/uploadPhoto.js';

const router = express.Router();

// GET /api/staff-cleaning/list?branch_id=xxx&month=2026-08-01
// 回傳全部項目，附上這個月每一項各自的完成紀錄（可能多人各自完成過）
router.get('/list', async (req, res) => {
  const { branch_id, month } = req.query;
  const { data: templates, error } = await supabase
    .from('staff_cleaning_templates')
    .select('*')
    .eq('branch_id', branch_id)
    .order('category')
    .order('sort_order');
  if (error) return res.status(400).json({ error: error.message });

  const templateIds = templates.map((t) => t.id);
  const { data: completions } = await supabase
    .from('staff_cleaning_completions')
    .select('*, staff:staff_id(name)')
    .in('template_id', templateIds.length ? templateIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('month', month);

  const compByTemplate = {};
  (completions ?? []).forEach((c) => {
    compByTemplate[c.template_id] = compByTemplate[c.template_id] || [];
    compByTemplate[c.template_id].push(c);
  });

  res.json(templates.map((t) => ({ ...t, completions: compByTemplate[t.id] || [] })));
});

// GET /api/staff-cleaning/my-progress?branch_id=xxx&staff_id=xxx&month=2026-08-01
router.get('/my-progress', async (req, res) => {
  const { staff_id, month } = req.query;
  const { data, error } = await supabase
    .from('staff_cleaning_completions')
    .select('*, template:template_id(category, item_name)')
    .eq('staff_id', staff_id)
    .eq('month', month);
  if (error) return res.status(400).json({ error: error.message });

  const categories = new Set((data ?? []).map((c) => c.template?.category));
  res.json({ count: data.length, categories: Array.from(categories), items: data });
});

// POST /api/staff-cleaning/:templateId/complete
// { staff_id, month, photo_url }
// POST /api/staff-cleaning/:templateId/start
// 標記「處理中」，讓其他人看到有人在做，避免重複認領
router.post('/:templateId/start', async (req, res) => {
  const { templateId } = req.params;
  const { staff_id, month } = req.body;
  const { data, error } = await supabase
    .from('staff_cleaning_completions')
    .upsert(
      { template_id: templateId, staff_id, month, status: 'in_progress' },
      { onConflict: 'template_id,staff_id,month' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/:templateId/complete', async (req, res) => {
  const { templateId } = req.params;
  const { staff_id, month, photo_url } = req.body;
  const storedPhotoUrl = await uploadPhotoIfBase64(photo_url, 'staff-cleaning');
  const { data, error } = await supabase
    .from('staff_cleaning_completions')
    .upsert(
      { template_id: templateId, staff_id, month, completed_date: new Date().toISOString().slice(0, 10), photo_url: storedPhotoUrl, status: 'completed' },
      { onConflict: 'template_id,staff_id,month' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
