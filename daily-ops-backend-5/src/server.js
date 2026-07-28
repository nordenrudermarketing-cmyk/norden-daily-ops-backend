import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import staffRoutes from './routes/staff.js';
import roomCleaningRoutes from './routes/roomCleanings.js';
import bonusRoutes from './routes/bonus.js';
import roomsRoutes from './routes/rooms.js';
import dashboardRoutes from './routes/dashboard.js';
import deepCleanRoutes from './routes/deepClean.js';
import shiftTasksRoutes from './routes/shiftTasks.js';
import issuesRoutes from './routes/issues.js';
import handoverRoutes from './routes/handover.js';
import scheduleRoutes from './routes/schedule.js';
import templatesRoutes from './routes/templates.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // 缺失照片用 base64 傳，稍微放寬上限

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'norden-daily-ops-backend' }));

app.use('/api', staffRoutes);
app.use('/api/room-cleanings', roomCleaningRoutes);
app.use('/api/bonus', bonusRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/deep-clean', deepCleanRoutes);
app.use('/api/shift-tasks', shiftTasksRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/templates', templatesRoutes);

// 提供同仁端網頁（登入、打卡、巡房檢查）
app.use(express.static(path.join(__dirname, '..', 'public')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`daily-ops-backend listening on :${port}`));
