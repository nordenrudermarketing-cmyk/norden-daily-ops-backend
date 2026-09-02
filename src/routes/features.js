import express from 'express';
import { FEATURE_CATALOG, LOCKED_KEYS } from '../lib/featureCatalog.js';
import { listFeatures, setFeatureState, getFeatureState } from '../lib/featureState.js';

const router = express.Router();

// 目前是「全開」「只開自評表」還是「自訂」——給後台顯示狀態用
function modeOf(features) {
  const switchable = features.filter((f) => !f.locked);
  if (switchable.every((f) => f.enabled)) return 'all';
  if (switchable.every((f) => !f.enabled)) return 'self_eval_only';
  return 'custom';
}

// GET /api/features
// 前端（側邊選單、登入導頁、總公司後台）都吃這一支
router.get('/', async (req, res) => {
  try {
    const features = await listFeatures();
    res.json({
      mode: modeOf(features),
      features,
      // 方便前端直接查：被關掉的網頁清單
      disabled_pages: features.filter((f) => !f.enabled).flatMap((f) => f.pages),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/features/state — 只要 { key: true/false }
router.get('/state', async (req, res) => {
  try {
    res.json(await getFeatureState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/features/:key  { enabled, updated_by }
router.put('/:key', async (req, res) => {
  const { key } = req.params;
  const { enabled, updated_by } = req.body;

  if (!FEATURE_CATALOG.some((f) => f.key === key)) {
    return res.status(404).json({ error: `沒有這個功能：${key}` });
  }
  if (LOCKED_KEYS.includes(key)) {
    return res.status(400).json({ error: '這個功能是系統保留項目，不能關閉' });
  }
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled 必須是 true 或 false' });
  }

  try {
    await setFeatureState({ [key]: enabled }, updated_by || null);
    const features = await listFeatures();
    res.json({ mode: modeOf(features), features });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/features/bulk  { updates: { key: boolean, ... }, updated_by }
router.post('/bulk', async (req, res) => {
  const { updates, updated_by } = req.body || {};
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: '缺少 updates' });
  }
  try {
    await setFeatureState(updates, updated_by || null);
    const features = await listFeatures();
    res.json({ mode: modeOf(features), features });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/features/preset/:name  { updated_by }
// self-eval-only：除了保留項目以外全部關掉
// enable-all：全部打開
router.post('/preset/:name', async (req, res) => {
  const { name } = req.params;
  const { updated_by } = req.body || {};

  let enabled;
  if (name === 'self-eval-only') enabled = false;
  else if (name === 'enable-all') enabled = true;
  else return res.status(400).json({ error: `不認得的預設值：${name}` });

  const updates = {};
  FEATURE_CATALOG.forEach((f) => {
    if (!f.locked) updates[f.key] = enabled;
  });

  try {
    await setFeatureState(updates, updated_by || null);
    const features = await listFeatures();
    res.json({ mode: modeOf(features), features });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
