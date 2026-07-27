import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import staffRoutes from './routes/staff.js';
import roomCleaningRoutes from './routes/roomCleanings.js';
import bonusRoutes from './routes/bonus.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', service: 'norden-daily-ops-backend' }));

app.use('/api', staffRoutes);
app.use('/api/room-cleanings', roomCleaningRoutes);
app.use('/api/bonus', bonusRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`daily-ops-backend listening on :${port}`));
