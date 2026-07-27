import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/rooms?branch_id=xxx
// 該館所有啟用中的房號，依樓層＋房號排序
router.get('/', async (req, res) => {
  const { branch_id } = req.query;
  const { data, error } = await supabase
    .from('rooms')
    .select('id, room_number, floor, is_large')
    .eq('branch_id', branch_id)
    .eq('is_active', true)
    .order('floor')
    .order('room_number');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
