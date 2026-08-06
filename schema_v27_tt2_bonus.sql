-- ============================================================
-- 台東2館房務獎金規則（7/1起正式生效）
-- 前10間$10/間、第11間起$20/間，沒有達標門檻（做幾間算幾間）
-- 缺失從淨間數扣（等同「該房間獎金取消」的效果）
-- 請到 Supabase SQL Editor 執行
-- ============================================================

insert into bonus_settings (branch_id, daily_target_rooms, rate_type, tier1_max, tier1_rate, tier2_rate, require_full_completion)
select id, 10, 'tiered', 10, 10, 20, false
from branches where code = 'TT2';
