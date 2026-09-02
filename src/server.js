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
import managerChecklistRoutes from './routes/managerChecklist.js';
import trainingRoutes from './routes/training.js';
import assessmentRoutes from './routes/assessment.js';
import hqRoutes from './routes/hq.js';
import roomMaintenanceRoutes from './routes/roomMaintenance.js';
import publicAreaRoutes from './routes/publicArea.js';
import selfEvalRoutes from './routes/selfEval.js';
import reflectionsRoutes from './routes/reflections.js';
import noShowRoutes from './routes/noShow.js';
import reviewCheckRoutes from './routes/reviewCheck.js';
import routineTasksRoutes from './routes/routineTasks.js';
import managerReportsRoutes from './routes/managerReports.js';
import orderSweepRoutes from './routes/orderSweep.js';
import staffCleaningRoutes from './routes/staffCleaning.js';
import writtenExamRoutes from './routes/writtenExam.js';
import bonusAppealsRoutes from './routes/bonusAppeals.js';
import adhocTasksRoutes from './routes/adhocTasks.js';
import managerMemoRoutes from './routes/managerMemo.js';
import managerWorksheetRoutes from './routes/managerWorksheet.js';
import featuresRoutes from './routes/features.js';
import { featureGuard } from './lib/featureGuard.js';
import { CURRENT_DB_SCHEMA } from './supabaseClient.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // 缺失照片用 base64 傳，稍微放寬上限

// db_schema 會告訴你這個網址連的是正式資料（public）還是測試資料（staging），
// 部署完先打開 /api/health 確認一下，比較不會搞混
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', service: 'norden-daily-ops-backend', db_schema: CURRENT_DB_SCHEMA }));

// 功能開關：總公司關掉的功能，對應 API 一律擋在這裡（沒對應到的路徑照常放行）
app.use('/api', featureGuard);

app.use('/api/features', featuresRoutes);
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
app.use('/api/manager-checklist', managerChecklistRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/hq', hqRoutes);
app.use('/api/room-maintenance', roomMaintenanceRoutes);
app.use('/api/public-area-maintenance', publicAreaRoutes);
app.use('/api/self-eval', selfEvalRoutes);
app.use('/api/reflections', reflectionsRoutes);
app.use('/api/no-show', noShowRoutes);
app.use('/api/review-checks', reviewCheckRoutes);
app.use('/api/routine-tasks', routineTasksRoutes);
app.use('/api/manager-reports', managerReportsRoutes);
app.use('/api/order-sweep', orderSweepRoutes);
app.use('/api/staff-cleaning', staffCleaningRoutes);
app.use('/api/written-exam', writtenExamRoutes);
app.use('/api/bonus-appeals', bonusAppealsRoutes);
app.use('/api/adhoc-tasks', adhocTasksRoutes);
app.use('/api/manager-memo', managerMemoRoutes);
app.use('/api/manager-worksheet', managerWorksheetRoutes);

// 提供同仁端網頁（登入、打卡、巡房檢查）
app.use(express.static(path.join(__dirname, '..', 'public')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`daily-ops-backend listening on :${port}`));
