-- ============================================================
-- 追加：① 週輪替檢查重點提示（掛在既有任務上）② 修正兩處文字差異
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

-- ① 新表：任務的週次提醒（依第幾週顯示不同重點）
create table shift_task_focus_notes (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id),
  task_name    text not null,   -- 要對應到哪個任務項目（依 task_name 完全比對）
  week_number  int not null,    -- 1~5（第4、5週共用同一則提醒）
  note         text not null
);

insert into shift_task_focus_notes (branch_id, task_name, week_number, note)
select (select id from branches where code = 'TT1'), t.task_name, t.week_number, t.note
from (values
  ('房間加強巡查', 1, '★牆壁、天花板、層板：髒汙、發霉、灰塵？'),
  ('房間加強巡查', 2, '★窗台、窗戶：窗溝灰塵？(須拿梯子)'),
  ('房間加強巡查', 3, '★窗簾、洗手台、排水口：發霉髒汙？落水頭乾淨，沒卡頭髮？'),
  ('房間加強巡查', 4, '★故事書、文具袋：外殼破爛？發霉？書籤因易皺先不放。'),
  ('房間加強巡查', 5, '★故事書、文具袋：外殼破爛？發霉？書籤因易皺先不放。'),
  ('公區抽查(週三，17:30之後)', 1, '★蜘蛛網　各樓層(尤其：氣窗、柱子、書架)、石子路逃生梯'),
  ('公區抽查(週三，17:30之後)', 2, '★玻璃通透　對外落地窗、內部拉門(1F、RF)'),
  ('公區抽查(週三，17:30之後)', 3, '★柱間層板、書架'),
  ('公區抽查(週三，17:30之後)', 4, '★公廁、淋浴間　-整潔(發霉痕跡、灰塵、頭髮、黏稠物) -備品足(擦手紙)'),
  ('公區抽查(週三，17:30之後)', 5, '★公廁、淋浴間　-整潔(發霉痕跡、灰塵、頭髮、黏稠物) -備品足(擦手紙)')
) as t(task_name, week_number, note);

-- ② 修正文字差異（8月版跟原本7月版建的內容有些微調）
update shift_task_templates
set task_name = '12點關投影機、打單&回訊息 (13:30前)、代A間休'
where branch_id = (select id from branches where code = 'TT1')
  and shift_code = 'C' and schedule_pattern = 'ABC'
  and task_name = '12點關投影機、打單&回訊息 (13:30前)、代A開午休';

update shift_task_templates
set task_name = '回報缺失、填寫房務日誌、紀錄續掃、簽八大稽核'
where branch_id = (select id from branches where code = 'TT1')
  and shift_code = 'C' and schedule_pattern = 'ABC'
  and task_name = '回報缺失、填寫房務日誌、簽八大稽核';

update shift_task_templates
set task_name = '關投影機、代B間休、打單&回訊息 (18:30前)'
where branch_id = (select id from branches where code = 'TT1')
  and shift_code = 'C' and schedule_pattern = 'ABC'
  and task_name = '關投影機、代B開午休、打單&回訊息 (18:30前)';

update shift_task_templates
set task_name = '夜間保全：19點晚到插卡、20點確認房況'
where branch_id = (select id from branches where code = 'TT1')
  and shift_code = 'B' and schedule_pattern = 'AABB'
  and task_name = '夜間保全：19點晚班插卡、20點確認房況';
