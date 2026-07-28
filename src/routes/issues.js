import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// POST /api/issues/report
// { branch_id, source_type, source_id, source_label, reported_by, description, photo_url }
// 通用回報：房務任務、客務班別任務、細清任務都可以呼叫同一支
// source_label 是給交班表顯示用的可讀名稱（例如任務名稱），不影響資料庫關聯
router.post('/report', async (req, res) => {
  const { branch_id, source_type, source_id, source_label, reported_by, description, photo_url } = req.body;
  if (!description) return res.status(400).json({ error: '請填寫回報說明' });

  const { data, error } = await supabase
    .from('defect_logs')
    .insert({
      branch_id,
      source_type,
      source_id,
      reported_by,
      description: source_label ? `【${source_label}】${description}` : description,
      photo_url: photo_url || null,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
