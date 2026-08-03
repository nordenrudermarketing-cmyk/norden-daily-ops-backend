-- ============================================================
-- 追加：① 建立台東2館 ② 批次匯入全館員工帳號（用員工編號當登入代碼）
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

-- ① 台東2館
insert into branches (name, code)
select '台東2館', 'TT2'
where not exists (select 1 from branches where code = 'TT2');

-- ② 批次匯入（38人）
-- 已經存在的登入代碼會被跳過，不會覆蓋、不會報錯，可以放心重複執行
insert into staff (name, branch_id, role_id, login_code, is_part_time, is_active)
select
  t.name,
  (select id from branches where code = t.branch_code),
  (select id from roles where name = t.role_name),
  t.login_code,
  t.is_part_time,
  true
from (values
  ('119', '鄒御書', '店經理', 'TT2', false),
  ('121', '劉冠宏', '店經理', 'TC', false),
  ('123', '賴繪喬', '店經理', 'TC', false),
  ('203', '沈黛君', '店經理', 'TT1', false),
  ('308', '曾心璇', '店經理', 'TT2', false),
  ('226', '曾柏翰', '客務人員', 'TT1', false),
  ('238', '林映辰', '客務人員', 'TT2', false),
  ('241', '劉婕瑜', '客務人員', 'TC', false),
  ('244', '李怡慧', '客務人員', 'TT2', false),
  ('253', '周敬倫', '客務人員', 'TT1', false),
  ('255', '王資媛', '客務人員', 'TT2', false),
  ('258', '凃奕安', '客務人員', 'TC', false),
  ('260', '張芳毓', '客務人員', 'TC', false),
  ('261', '蘇怡姍', '客務人員', 'TT2', false),
  ('345', '郭胤辰', '客務人員', 'TT2', false),
  ('524', '王苡臻', '客務人員', 'TC', false),
  ('528', '邱榆芳', '客務人員', 'TC', false),
  ('531', '王治為', '客務人員', 'TT1', false),
  ('541', '張瑞妤', '客務人員', 'TT1', false),
  ('549', '李竹馨', '客務人員', 'TT1', false),
  ('303', '邱曉娸', '房務人員', 'TT1', false),
  ('307', '盧永珍', '房務人員', 'TT2', false),
  ('328', '林筱妍', '房務人員', 'TT2', false),
  ('333', '施棨竣', '房務人員', 'TC', false),
  ('337', '張巧玟', '房務人員', 'TT2', false),
  ('341', '何友宜', '房務人員', 'TC', false),
  ('343', '謝宜秦', '房務人員', 'TC', false),
  ('346', '蘇宣豪', '房務人員', 'TC', false),
  ('349', '周羽煥', '房務人員', 'TC', false),
  ('350', '江俊奇', '房務人員', 'TT2', false),
  ('351', '因德拉INDRA', '房務人員', 'TT1', false),
  ('352', '瑞菲塔REFITA', '房務人員', 'TC', false),
  ('353', '伊隆ELON', '房務人員', 'TT2', false),
  ('354', '利冠真', '房務人員', 'TT2', false),
  ('522', '黃紹華', '房務人員', 'TT1', false),
  ('550', '王彩芸', '房務人員', 'TT1', false),
  ('509', '陳靳豫玟', '房務人員', 'TT1', true),
  ('515', '黃思萍', '房務人員', 'TT1', true)
) as t(login_code, name, role_name, branch_code, is_part_time)
on conflict (login_code) do nothing;
