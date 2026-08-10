-- ============================================================
-- 更新筆試題庫：刪除3題、12題選擇題補上正確答案、新增1題、5題問答附參考答案
-- 三館（台中館/台東1館/台東2館）都套用同一份，請到 Supabase SQL Editor 執行
-- ============================================================

-- ① 刪除確認要拿掉的3題選擇題
delete from written_exam_questions
where section = '選擇題' and question_text in (
  '關於長住方案何者為非。',
  '關於額外服務下列選項何者正確',
  '關於官網預訂下列何者正確'
);

-- ② 12題選擇題補上正確答案
update written_exam_questions set correct_answer = 'A' where section = '選擇題' and question_text = '以下關於OTA訂房網選項何者為非。';
update written_exam_questions set correct_answer = 'C' where section = '選擇題' and question_text = '官網預訂以下何者為正確。';
update written_exam_questions set correct_answer = 'A' where section = '選擇題' and question_text = '關於OTA取消預訂、更改日期何者為正確';
update written_exam_questions set correct_answer = 'A' where section = '選擇題' and question_text = '關於團體訂單的須知何者為非';
update written_exam_questions set correct_answer = 'C' where section = '選擇題' and question_text = '關於OTA、官網平台預訂付款問題何者正確';
update written_exam_questions set correct_answer = 'C' where section = '選擇題' and question_text = '關於現場預訂、電話預訂何者為錯誤';
update written_exam_questions set correct_answer = 'D' where section = '選擇題' and question_text = '以下關於打訂單之內容何者為非';
update written_exam_questions set correct_answer = 'A' where section = '選擇題' and question_text = '關於下列敘述何者為非';
update written_exam_questions set correct_answer = 'A' where section = '選擇題' and question_text = '關於下列敘述何者為正確' and options_text like '%5/10-5/13%';
update written_exam_questions set correct_answer = 'A' where section = '選擇題' and question_text = '關於下列訂房類型敘述何者為正確';
update written_exam_questions set correct_answer = 'B' where section = '選擇題' and question_text = '關於下列敘述何者為正確' and options_text like '%經濟單人房%';

-- ③ 拿掉「取消延期費用訂單順序排列」這題（舊版已不用）
-- 「聯合卡機」這題最後決定不用（沒有確定答案），不新增進題庫
delete from written_exam_questions
where section = '選擇題' and question_text like '%取消延期費用之訂單順序%';

delete from written_exam_questions
where section = '選擇題' and question_text like '%聯合卡機%';

-- ④ 5題問答題附上參考答案（只給經理審閱用，不會顯示給作答的人）
update written_exam_questions set reference_answer =
'發現遺留物先致電聯繫客人詢問是否還需要。
有聯繫上：1.客人晚點自行回來取回：請房務拿下來，並編號寫遺留物本&交班追蹤。2.客人需寄回：提醒客人是黑貓貨到付款，如客人OK留下客人寄件地址，並填寫黑貓收貨單&請黑貓來收件，在寫交班追蹤，若黑貓收貨後要傳追蹤碼。3.客人不要：直接丟棄。
未聯繫上：請房務拿下來，並編號寫遺留物本，放到遺留物區保留1個月。'
where section = '問答題' and question_text like '%客人遺留物%';

update written_exam_questions set reference_answer =
'預先授權為確認信用卡為有效卡，以及卡的額度是否足夠支付房費，若預授成功，只是暫押信用卡額度，並非正式交易，如未實際預授完成，銀行約一個帳單週期會將額度歸還。
預授時機主要為週六或是旺日，前一天會先詢問抵達時間，若隔天11:00都未回覆，即會進行預授。
預授失敗處理：Booking：後台標記信用卡無效，並傳訊提醒客人更新，需壓交班追蹤，若無更新，後台時間到即可取消。官網：傳簡訊提醒客人更新卡，並寫交班壓時間，時間到了未更新一樣取消。'
where section = '問答題' and question_text like '%預先授權%';

update written_exam_questions set reference_answer =
'對外告知櫃台服務時間只到晚上09:00，若確定會超過晚上09:00抵達，須提前通知櫃台，才能安排晚到入住手續。
若跟客人確定晚到後，詢問客人付款方式，匯款、雲端或是可以直接刷OTA上留下的信用卡，並詢問是否要統編，如結帳成功後，將房卡簽單發票包起來，放進小木屋，並傳送大門密碼以及房卡放置位置給客人，最後寫交班提醒隔天需補資料簽單。'
where section = '問答題' and question_text like '%晚到入住流程%';

update written_exam_questions set reference_answer =
'延期單主要為客人取消需收取消費，但情況特殊，特別同意客人可以3個月內來使用。
處理步驟為：確認訂單已是取消狀態(若是客人一直沒取消，先按保留單避免佔房)→直接收費，並開立發票(除客人要求要發票，否則留存櫃台)→旅安回復訂單→入帳後再取消一次訂單，並灌取消費→完成於訂單備註，取消費多少錢，期限到什麼時候→通知客人延期費須知(期限三個月，限手工訂房，多不退少須補，使用後無法再次更改)。'
where section = '問答題' and question_text like '%取消延期費用延期說明%';

update written_exam_questions set reference_answer =
'若客人遺失房卡，需與客人收取費用$500，並重新製卡。
若客人離開後才發現未還房卡，需與客人聯繫，若客人要用寄回的方式，需與客人說明會先預先授權(並非正式結帳)，並且寫交班追蹤。'
where section = '問答題' and question_text like '%房卡遺失%';
