-- ============================================================
-- 追加：① 獎金門檻修正為固定數字（不是「全部完成」）
--      ② PT 同仁不列入房務獎金
--      ③ 排班表加入「房務小隊長」每日指定
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

-- ① 獎金門檻：改成跟固定數字比較（例如12間），不是跟當天分配總數比較
alter table bonus_settings add column if not exists min_rooms_for_bonus int;

-- 台東1館：15:00前沒滿12間，整天不算獎金
update bonus_settings
set min_rooms_for_bonus = 12
where branch_id = (select id from branches where code = 'TT1');

-- ② PT（兼職）同仁不算房務打掃獎金
alter table staff add column if not exists is_part_time boolean default false;

-- ③ 每日房務小隊長（經理排班時一併指定，跟班別代碼分開存）
create table daily_team_leads (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references branches(id),
  work_date   date not null,
  staff_id    uuid references staff(id),
  unique (branch_id, work_date)
);
