-- ============================================================
-- 台東1館客務例行事項匯入（依「8月客務日誌-例行」整理）
-- 請到 Supabase SQL Editor 執行
-- ============================================================

-- 這個月專屬的一次性任務（原始檔案「例行/任務」區塊）
insert into routine_tasks (branch_id, category, item_name, progress_note, assigned_to, status)
select
  (select id from branches where code = 'TT1'),
  t.category, t.item_name, t.note,
  (select id from staff where name = t.person_name and branch_id = (select id from branches where code = 'TT1')),
  'pending'
from (values
  ('任務', '柏翰', '教學-竹馨採購：防水標籤（室外機寫房號用，15cm(W)*10cm(H)，買80pcs）；小米電扇故障，評估是否能維修、買一台多少錢', null),
  ('任務', '治為', '廠商-大金故障維修：321室「外」機機板（用307零件）；1F備品室換蒸發器；找207問題點', null),
  ('任務', '治為', '口布漂白，於盤點表紀錄', null),
  ('任務', '治為', '買第2張椅子', null),
  ('任務', '周敬倫', '清空櫃子-書架洞洞板；優化櫃子（電梯前垃圾桶上／資料室、櫃台備品架、副櫃旁櫃子）', null),
  ('任務', '治為', '整理2F圖書區', null),
  ('任務', '治為', '更換副櫃電腦', '7/7評估更換，公司OK；廠商效能評估、汰換估價（含資料轉換）'),
  ('任務', '瑞妤', '陳列調整（櫃台旁／書架櫃）；協助房務家具表（預計8/15，全館含地下室：桌子/椅子/櫃子/掛架/鏡子/衣架/其他）', null),
  ('任務', '竹馨', '迎賓水調製SOP', null)
) as t(category, person_name, item_name, note);

-- 每月固定例行項目（原始檔案下方「例行」表格區塊，依採購/銀行/總務分類）
insert into routine_tasks (branch_id, category, item_name, progress_note, assigned_to, due_date, status)
select
  (select id from branches where code = 'TT1'),
  t.category, t.item_name, t.note,
  (select id from staff where name = t.person_name and branch_id = (select id from branches where code = 'TT1')),
  t.due_date::date,
  t.status
from (values
  ('採購', '治為', '例行叫貨 W5（上個月）', '叫貨本項目：到貨了麻煩寫OK；還沒處理到，再請完成', null, 'completed'),
  ('採購', '竹馨', '例行叫貨 W1', '見SOP（柏翰整理中）：三立／叫貨本(衛生棉)／急救箱／櫃台(發票/簽單/早餐券/耳塞/口罩/A4/擴香/原子筆/帆布袋)、廚房用品(冰箱貼紙/調味料)／茶道體驗、手沖咖啡體驗、效期', null, 'pending'),
  ('採購', '竹馨', '例行叫貨 W2', null, null, 'pending'),
  ('採購', '竹馨', '例行叫貨 W3', null, null, 'pending'),
  ('採購', '竹馨', '例行叫貨 W4', null, null, 'pending'),
  ('採購', '竹馨', '例行叫貨 W5（截至月底結算完畢再交棒，來不及就移至下個月）', null, null, 'pending'),
  ('採購', '竹馨', '特殊採買', '8/27要普渡拜拜，供品1700元+金紙300元需提前買，共2000元；金紙7/25已叫300元（新臉盆+金紙，館內還有新毛巾），預計8/27早上送貨', '2026-08-27', 'pending'),
  ('銀行', '竹馨', '計算營收--剩餘項目：月底以前', 'Allen代完成', '2026-08-04', 'completed'),
  ('銀行', '周敬倫', '存營收、換鈔票、零錢 W1', '8/2已先算好截至8/1的現金營收', '2026-08-03', 'completed'),
  ('銀行', '周敬倫', '存營收、換鈔票、零錢 W2', null, null, 'pending'),
  ('銀行', '周敬倫', '存營收、換鈔票、零錢 W3', null, null, 'pending'),
  ('銀行', '周敬倫', '存營收、換鈔票、零錢 W4', '請協助黛君領?K+換百鈔(1萬元)', null, 'pending'),
  ('銀行', '周敬倫', '存營收、換鈔票、零錢 W5（截至月底結算完畢再交棒，來不及就移至下個月）', null, null, 'pending'),
  ('銀行', '周敬倫', '垃圾處理費、買手開發票（偶數月22號以後）', '憑證已放大保險箱、通知店長補款', null, 'pending'),
  ('總務', '柏翰', '總務事項（上個月未完成）', '請列出內容（已完成請寫：無）', null, 'pending'),
  ('總務', '治為', '月初-八大稽核歸檔（廁所、防火、急救箱、飲水機填表、防止針孔）', '跟店長要印章；急救箱（檢查效期&寫叫貨本）', null, 'pending'),
  ('總務', '治為', '月初-換大門密碼', '請因德拉轉告另位實習生（伊隆）；8/1已完成；更換密碼：房務群組、保全群組、罐頭(中英文)、傳簡訊系統、館內實習生們', null, 'completed'),
  ('總務', '治為', '維修紀錄表、櫃台盤點表、電池表格', '由「回報離開、經手異動」的人紀錄，總務檢查為主，建議每週；所有維修項目都可記錄，以冷氣、洗烘機為主', null, 'pending'),
  ('總務', '治為', '月底：下個月房務表格', '請問黛君注意事項：1.保養ABCD區?+加工季清 2.掃房紀錄表', null, 'pending'),
  ('總務', '治為', '月底：更新萬用卡&提醒換卡', '見製卡表格（定時器要重設定=>強制供電後，不用重設了）', null, 'pending'),
  ('總務', '治為', '月底：取消費', '請小組回報：漏掉取消費的處置方式', null, 'pending'),
  ('總務', '治為', '月底：發票兌獎（單月25號）&整理', null, null, 'pending'),
  ('總務', '治為', '開會點餐', '房務會議：待安排；櫃台會議：待安排；店長安排日期後會告知當月負責人員，如果當月沒有使用就當作放棄；需安排吃食店+點餐+取餐，員工福利金共3000元，發票要開統編60326776', null, 'pending')
) as t(category, person_name, item_name, note, due_date, status);
