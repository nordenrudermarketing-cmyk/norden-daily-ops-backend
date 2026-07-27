import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// 後端一律用 service_role key，繞過 RLS，因為權限控制在 API 層自己做
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
