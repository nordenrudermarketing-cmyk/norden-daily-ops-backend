-- ============================================================
-- 追加：① 獎金申覆機制 ② 客訴不可控/房務缺失分類
--      ③ 個人清潔配額處理中狀態 ④ 房務自檢表印尼文翻譯
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v32_seed.sql
-- ============================================================

-- ① 獎金申覆：店經理核准後，那天的達標門檻會被豁免（還是照淨間數算級距，只是不會整天歸零）
create table bonus_appeals (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid references staff(id),
  branch_id     uuid references branches(id),
  work_date     date not null,
  reason        text,          -- 同仁申請理由
  status        text default 'pending',  -- pending / approved / rejected
  approved_by   uuid references staff(id),
  approved_at   timestamptz,
  created_at    timestamptz default now(),
  unique (staff_id, work_date)
);

-- ② 客訴分類：不可控（例如冷氣壞掉）不影響房務獎金；房務缺失才會扣淨間數
alter table room_cleanings add column if not exists complaint_category text;
-- 'housekeeping'（房務缺失，會扣獎金）／'uncontrollable'（不可控，只留紀錄不扣獎金）

-- ③ 個人清潔配額：加「處理中」狀態，避免兩人同時做同一項卻不知道
alter table staff_cleaning_completions add column if not exists status text default 'completed';
-- 'in_progress'／'completed'；為了不動到既有資料，預設值維持 completed（舊資料視為已完成）

-- ④ 房務自檢表加印尼文翻譯欄位已經存在（question_id），這份只是補資料，見 seed 檔
