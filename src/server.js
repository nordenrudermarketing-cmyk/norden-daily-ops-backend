import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import staffRoutes from './routes/staff.js';
import roomCleaningRoutes from './routes/roomCleanings.js';
import bonusRoutes from './routes/bonus.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // 缺失照片用 base64 傳，稍微放寬上限

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'norden-daily-ops-backend' }));

app.use('/api', staffRoutes);
app.use('/api/room-cleanings', roomCleaningRoutes);
app.use('/api/bonus', bonusRoutes);

// 提供同仁端網頁（登入、打卡、巡房檢查）
app.use(express.static(path.join(__dirname, '..', 'public')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`daily-ops-backend listening on :${port}`));
