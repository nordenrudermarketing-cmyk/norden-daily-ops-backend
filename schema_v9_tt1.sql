-- ============================================================
-- 追加：① 台東1館館別＋房號基礎資料 ② 分館可自訂獎金規則
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

-- ------------------------------------------------------------
-- ① 台東1館館別
-- ------------------------------------------------------------
insert into branches (name, code)
select '台東1館', 'TT1'
where not exists (select 1 from branches where code = 'TT1');

-- rooms 表加一個 zone 欄位（台東1館用 A-E 責任區分組，台中館沒有這層，留空即可）
alter table rooms add column if not exists zone text;

-- 台東1館房號（63間，A-E責任區）
insert into rooms (branch_id, room_number, floor, is_large, zone)
select (select id from branches where code = 'TT1'), room_number, floor, is_large, zone
from (values
  ('201', 2, false, 'A'),
  ('202', 2, false, 'A'),
  ('215', 2, false, 'A'),
  ('216', 2, false, 'A'),
  ('217', 2, false, 'A'),
  ('218', 2, false, 'A'),
  ('219', 2, false, 'A'),
  ('220', 2, false, 'A'),
  ('221', 2, false, 'A'),
  ('222', 2, false, 'A'),
  ('223', 2, false, 'A'),
  ('317', 3, false, 'A'),
  ('318', 3, false, 'A'),
  ('203', 2, false, 'B'),
  ('205', 2, false, 'B'),
  ('206', 2, false, 'B'),
  ('207', 2, false, 'B'),
  ('208', 2, false, 'B'),
  ('209', 2, false, 'B'),
  ('210', 2, false, 'B'),
  ('211', 2, false, 'B'),
  ('212', 2, false, 'B'),
  ('213', 2, false, 'B'),
  ('301', 3, false, 'B'),
  ('323', 3, false, 'B'),
  ('302', 3, false, 'C'),
  ('R01', 99, false, 'C'),
  ('R02', 99, false, 'C'),
  ('R03', 99, false, 'C'),
  ('R07', 99, false, 'C'),
  ('R08', 99, false, 'C'),
  ('R09', 99, false, 'C'),
  ('R10', 99, false, 'C'),
  ('R11', 99, false, 'C'),
  ('R12', 99, false, 'C'),
  ('R13', 99, false, 'C'),
  ('R17', 99, false, 'C'),
  ('R18', 99, false, 'C'),
  ('303', 3, false, 'D'),
  ('305', 3, false, 'D'),
  ('306', 3, false, 'D'),
  ('307', 3, false, 'D'),
  ('308', 3, false, 'D'),
  ('309', 3, false, 'D'),
  ('310', 3, false, 'D'),
  ('311', 3, false, 'D'),
  ('312', 3, false, 'D'),
  ('313', 3, false, 'D'),
  ('R05', 99, false, 'D'),
  ('R06', 99, false, 'D'),
  ('315', 3, false, 'E'),
  ('316', 3, false, 'E'),
  ('319', 3, false, 'E'),
  ('320', 3, false, 'E'),
  ('321', 3, false, 'E'),
  ('322', 3, false, 'E'),
  ('R15', 99, false, 'E'),
  ('R16', 99, false, 'E'),
  ('R19', 99, false, 'E'),
  ('R20', 99, false, 'E'),
  ('R21', 99, false, 'E'),
  ('R22', 99, false, 'E'),
  ('R23', 99, false, 'E')
) as t(room_number, floor, is_large, zone);

-- ------------------------------------------------------------
-- ② 分館可自訂獎金規則
-- ------------------------------------------------------------
-- rate_type：linear（台中館：淨間數 × 固定單價）／ tiered（台東1館：級距制）
-- tier1_max / tier1_rate / tier2_rate：級距制才用得到，例如前12間$10、第13間起$20
-- require_full_completion：true 代表「當天沒有在期限前把被分配的房間全部完成，整天不算獎金」
alter table bonus_settings add column if not exists rate_type text default 'linear';
alter table bonus_settings add column if not exists tier1_max int;
alter table bonus_settings add column if not exists tier1_rate numeric;
alter table bonus_settings add column if not exists tier2_rate numeric;
alter table bonus_settings add column if not exists require_full_completion boolean default false;

-- 台東1館的獎金規則：前12間$10、第13間起$20，且要求全部完成才算
insert into bonus_settings (branch_id, daily_target_rooms, rate_per_room, rate_type, tier1_max, tier1_rate, tier2_rate, require_full_completion)
select id, 12, 0, 'tiered', 12, 10, 20, true
from branches where code = 'TT1';
