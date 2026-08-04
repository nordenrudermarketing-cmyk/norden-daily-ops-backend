-- 台東1館客務個人清潔配額項目（20項，A-D四類）
insert into staff_cleaning_templates (branch_id, category, item_name, sort_order)
select (select id from branches where code = 'TT1'), t.category, t.item_name, t.sort_order
from (values
  ('A', '整理冰箱（丟過期、細清）', 1),
  ('A', '預授單整理 + 剪營收表 + 製作便條紙（裁剪房務日誌）', 2),
  ('A', '簽單袋整理 + 整理營收報表簽單', 3),
  ('A', '維護印章區（墊布、墨水）：1F、2F、RF', 4),
  ('A', 'ＤＭ區整理擦拭 + 海報更新（過期請丟）', 5),
  ('B', '整理冰箱（丟過期、細清）', 1),
  ('B', '擦拭 + 盤點櫃台商品（截圖-櫃台盤點表）', 2),
  ('B', '餐具、杯子、口布盤點（截圖-櫃台盤點表）', 3),
  ('B', '擦拭 + 盤點走走池上庫存（截圖-櫃台盤點表）', 4),
  ('B', '擦拭 + 盤點咖啡茶包（截圖-櫃台盤點表）', 5),
  ('C', '整理冰箱（丟過期、細清）', 1),
  ('C', '傘架整理', 2),
  ('C', '遺留物整理', 3),
  ('C', '果蠅誘餌清洗&補充', 4),
  ('C', '整理廚藝教室檯面&抽屜（希望不要看起來雜亂，請跟黛君討論）', 5),
  ('D', '整理冰箱（丟過期、細清）', 1),
  ('D', '抽油煙機（鏡子）用過碳酸鈉+40°C溫水，泡2小時', 2),
  ('D', '抽油煙機（中島）用過碳酸鈉+40°C溫水，泡2小時', 3),
  ('D', '細清咖啡機+手沖工具', 4),
  ('D', '擦拭：餐具、碗盤、杯子', 5)
) as t(category, item_name, sort_order);

-- 補入8月已完成的紀錄（用完整姓名比對，暱稱→完整姓名對照：柏翰=曾柏翰／治為=王治為／周敬倫=Allen）
-- 加上 limit 1 避免項目名稱剛好重複（例如「整理冰箱」在A/B/C/D四類都有）時查詢出錯
insert into staff_cleaning_completions (template_id, staff_id, month, completed_date)
select
  (select id from staff_cleaning_templates where branch_id=(select id from branches where code='TT1') and item_name = t.item_name limit 1),
  (select id from staff where name = t.person_name and branch_id=(select id from branches where code='TT1') limit 1),
  '2026-08-01',
  t.completed_date::date
from (values
  ('維護印章區（墊布、墨水）：1F、2F、RF', '曾柏翰', '2026-08-01'),
  ('預授單整理 + 剪營收表 + 製作便條紙（裁剪房務日誌）', '王治為', '2026-08-02'),
  ('擦拭 + 盤點咖啡茶包（截圖-櫃台盤點表）', '王治為', '2026-08-02'),
  ('遺留物整理', '周敬倫', '2026-08-02')
) as t(item_name, person_name, completed_date);
