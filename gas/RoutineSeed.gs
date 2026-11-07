// ============================================================
// 主管例行任務的初始內容（2026-11，依使用者整理的「經理例行工作總表_週月年.xlsx」修飾）
//
// 只在 routine_items 是空的時候匯入一次（試算表選單「匯入主管例行任務」）。
// 匯入之後一律在網頁的「例行任務設定」修改，不要再改這裡。
// branches 寫部門名稱（找不到的名稱會在匯入結果裡提醒）；沒寫＝所有部門。
// ============================================================

const ROUTINE_SEED = [
  // ---------- 週（沒寫 due_weekday＝週日前） ----------
  {
    period: 'week', category: '部門抽查與工作檢討', title: '房務、客務日誌檢討', times: 2,
    description: '通盤看過房務日誌、客務日誌。\n需要調整的事項，趁週末大部分同事都有上班時馬上布達。',
  },
  {
    period: 'week', category: '部門抽查與工作檢討', title: '抽查房務紀錄', times: 2,
    description: '1. 抽查一項房務日誌工作（公區）的執行狀況\n2. 抽查 1 間房間，確認狀況\n3. 抽查掃房紀錄表、保養表格、宿舍清潔',
    report_hint: '抽查的日誌工作、房號、同事',
  },
  {
    period: 'week', category: '部門抽查與工作檢討', title: '抽查客務紀錄', times: 2,
    description: '1. 抽查一項客務日誌工作（例行／任務／清潔）的執行狀況\n2. 抽查 1 張手工訂單，確認程序正確\n3. 確認同事接待、接聽電話正常',
    report_hint: '抽查的日誌工作、訂單號、同事',
  },
  {
    period: 'week', category: '日常巡檢', title: '館內巡檢', times: 2,
    description: '每次巡檢看這四項：\n1. 環境整潔：公共區域、房間清潔品質的細節\n2. 植物：館內植物狀況\n3. 備品品質：布巾、公區餐具、洗浴用品等客人會用到的物品\n4. 公區設備：冷氣、音響、燈光、洗衣機、冰箱、除濕機，重點檢測並調整到舒適',
    report_hint: '發現的問題和處理方式（都正常請寫「正常」）',
  },
  {
    period: 'week', category: '顧客回饋', title: '回覆四大平台評論',
    description: '回覆四大平台的評論。\n・負評：在經理群組回報，並檢討怎麼應對\n・特別表揚與負評：在房務群組公告，讓大家知道',
  },
  {
    period: 'week', category: '出勤管理', title: '打卡異常與申覆資料確認',
    description: '1. 確認同事依規定附上監視器畫面，並準時到崗\n2. 提醒打卡異常的同事',
  },
  {
    period: 'week', category: '財務控管', title: '櫃台零用金抽檢',
    description: '1. 抽檢櫃台金額是否正確、是否足夠，整理零用金並對帳\n2. 零用金或零錢不足時，安排補款',
  },
  {
    period: 'week', category: '庫存與人力安排', title: '確認下週房況與人力', due_weekday: 5,
    description: '1. 檢查庫存、修繕房，確認 OTA 前台販售頁面沒有不當壓房\n2. 到旅安 > 櫃台接待 > 板手 > 下載進退房統計，參考下週房況確認人力；整房較少時可以安排同事休假',
  },
  {
    period: 'week', category: '活動', title: '駐村活動確認', due_weekday: 5,
    description: '確認本週館內有哪些駐村活動、罐頭訊息是否已經更新、有沒有特殊狀況。',
  },

  // ---------- 月（steps：每行「日｜要做的事」，到了那天會標成「現在」） ----------
  {
    period: 'month', category: '排班', title: '下月班表', start_day: 1, due_day: 25,
    description: '從發空白班表到正式發布，一個月內分幾個時間點完成，最後在 25 號班表發布後回報完成。',
    steps: '1｜發空白班表給同事畫假，10 號收回\n10｜依假表排班，記得排農曆初二拜拜、特殊日、月會\n15｜給同事最後協調，20 號前定案\n25｜正式發布：班表圖檔放在群組記事本，班表檔案交給人事',
  },
  {
    period: 'month', category: '自評與評核', title: '自評、面談與月評核', start_day: 1, due_day: 31,
    description: '每月自評與評核的流程，月底在系統（Google 表單）繳交當月分數後回報完成。',
    steps: '1｜提醒同事（含主管自己）10 號前在系統完成自評\n10｜20 號前依自評內容和上月評核，跟同事個別面談\n20｜觀察同事是否落實自評或面談提到的改善建議\n28｜月底前繳交當月評核分數；不及格的同事要附上建議與改進方向',
  },
  {
    period: 'month', category: '人事與出勤管理', title: '加班申請與掃房獎金', start_day: 1, due_day: 5,
    description: '・代理加班、公務機工時在峰形系統申請：https://femascloud.com/ruderhotel/Users/main\n・主管加班需附協理或總經理同意證明\n・公務機值日表回傳人事',
    steps: '1｜代理加班、公務機申請，值日表回傳人事\n3｜計算掃房獎金，5 號前交給人事',
  },
  {
    period: 'month', category: '月會', title: '召開月會',
    description: '事先準備當月公告事項；會後把月會內容張貼在旅安公告事項區。',
  },
  {
    period: 'month', category: '人員招募', title: '面試新人', times: 2,
    description: '每月至少安排 2 位應徵者面試；館內有缺額時，自行增加面試的頻率和人數。',
    report_hint: '應徵者姓名或職缺',
  },
  {
    period: 'month', category: '零用金與文件回送', title: '文件回送與零用金請款', start_day: 1, due_day: 31,
    description: '月初寄回文件、月底請款，兩件都做完再回報完成。',
    steps: '1｜5 號前把文件寄回或交給總公司人員帶回：公務機簽名值日表、收據（支出）、合作店家收據、零用金請款單、作廢發票、手開發票、報價單、公文、人事卡、離職申請書、住宿優惠券等\n25｜整理經理零用金請款，月底前上傳 commeet；確認「請款金額＋現金餘額＝零用金總額」',
  },
  {
    period: 'month', category: '盤點與表格', title: '表格、叫貨與盤點', start_day: 1, due_day: 31,
    description: '月初印表格、依上月盤點叫貨，月底請房務盤點，做完再回報完成。',
    steps: '1｜印製表格並在群組告知同事：消防（日常火源、防火避難、消防安全，共三張）、衛生（供水系統、水塔清潔紀錄、廁所第三張）、房務（月清表、盤點表）\n1｜5 號前依上月盤點表叫貨：布巾（品寬）、館內燈泡與洗沐（逸婷）、房務消耗品（雲端_龍族：洗衣粉、紙巾、垃圾袋等）；超過 $3,000 要先呈報總經理或協理\n25｜請房務盤點館內所有消耗品、備品',
  },
  {
    period: 'month', category: '對帳', title: '停車場對帳', branches: ['台中館'], start_day: 25, due_day: 31,
    description: '核對火車站停車場的停車券數量是否正確。',
  },

  // ---------- 年（remind_month＝那個月開始提醒；due_hint 只是提示，不壓期限） ----------
  { period: 'year', category: '節慶布置', title: '新年裝飾與過年活動', remind_month: 1, due_hint: '1 月底或過年前', description: '新年裝飾、過年活動發想。' },
  { period: 'year', category: '節慶布置', title: '萬聖節布置', remind_month: 9, due_hint: '10 月中前' },
  { period: 'year', category: '節慶布置', title: '聖誕節布置', remind_month: 11, due_hint: '12 月初前' },
  { period: 'year', category: '三節獎金', title: '春節獎金', remind_month: 1, due_hint: '春節發放（約 2 月初）', description: '每人 $1,000；僅限正職且考核通過，發現金需簽收單。' },
  { period: 'year', category: '三節獎金', title: '端午獎金', remind_month: 5, due_hint: '端午節前', description: '每人 $500；僅限正職且考核通過，需簽收單。' },
  { period: 'year', category: '三節獎金', title: '中秋獎金', remind_month: 8, due_hint: '中秋節前', description: '每人 $500；僅限正職且考核通過，需簽收單。' },
  { period: 'year', category: '員工聚餐', title: '春酒', remind_month: 1, due_hint: '過年後', description: '預算每人 $1,000；當日晚班留守紅包 $1,500。\n先擬定方案與預算，向公司請示；原則上僅限正職且考核通過的同事。' },
  { period: 'year', category: '員工聚餐', title: '中秋烤肉聚餐', remind_month: 8, due_hint: '暑假後', description: '預算每人 $800；當日晚班留守紅包 $1,300。\n先擬定方案與預算，向公司請示；原則上僅限正職且考核通過的同事。' },
  { period: 'year', category: '拜拜', title: '除夕拜地基主', remind_month: 1, due_hint: '除夕', description: '供品 $1,000。過年拜拜的供品可以一起買；拜不同的神明要準備不同的供品，要買對、拜對。' },
  { period: 'year', category: '拜拜', title: '春節開工拜拜', remind_month: 1, due_hint: '農曆初二', description: '供品 $500。過年拜拜的供品可以一起買；拜不同的神明要準備不同的供品，要買對、拜對。' },
  { period: 'year', category: '拜拜', title: '中元普渡', remind_month: 8, due_hint: '中元節', description: '中元普渡 $2,000（含金紙）、中元地基主 $1,000。\n先查好要拜什麼，再調查館內缺什麼、大家想吃什麼。' },
  { period: 'year', category: '設備', title: '洗水塔（第一次）', remind_month: 2, due_hint: '過年後', description: '台中館請找阿波師傅報價後施作。' },
  { period: 'year', category: '設備', title: '洗水塔（第二次）', remind_month: 8, due_hint: '暑假後', description: '台中館請找阿波師傅報價後施作。' },
  { period: 'year', category: '設備', title: '抽水肥（上半年）', remind_month: 2, due_hint: '過年後', description: '每半年一次。' },
  { period: 'year', category: '設備', title: '抽水肥（下半年）', remind_month: 8, due_hint: '9/30 前', description: '每半年一次。' },
  { period: 'year', category: '設備', title: '冷氣清洗（第一次）', remind_month: 3, due_hint: '4/30 前', description: '同時檢測館內所有冷氣是否正常運作；務必請廠商把排水管也疏通。' },
  { period: 'year', category: '設備', title: '冷氣清洗（第二次）', remind_month: 9, due_hint: '10/31 前', description: '同時檢測館內所有冷氣是否正常運作；務必請廠商把排水管也疏通。' },
  { period: 'year', category: '設備', title: '熱水設備維護', remind_month: 9, due_hint: '10/31 前', description: '熱水器保養與測試；各樓層熱水測試與檢查。' },
  { period: 'year', category: '設備', title: '軟水過濾藥劑添加', branches: ['台東1館'], remind_month: 6, due_hint: '6/30 前', description: '聯繫森森熱水。' },
  { period: 'year', category: '設備', title: '夏季熱迴水／熱水溫度設定', branches: ['台東1館', '台東2館'], remind_month: 5, due_hint: '5/15 前', description: '依季節氣溫調整。' },
  { period: 'year', category: '設備', title: '冬季熱迴水／熱水溫度設定', branches: ['台東1館', '台東2館'], remind_month: 11, due_hint: '11/15 前', description: '依季節氣溫調整。' },
  { period: 'year', category: '設備', title: '壁癌檢查與處理', remind_month: 11, due_hint: '11/30 前', description: '房間調查 → 統計公區 → 詢價 → 安排施工。' },
  { period: 'year', category: '活動', title: '鐵人賽壓房（三月 2 場）', branches: ['台東1館', '台東2館'], remind_month: 1, due_hint: '2/28 前', description: '特殊活動日的壓房確認。' },
  { period: 'year', category: '活動', title: '鐵人賽壓房（四月 1 場）', branches: ['台東1館', '台東2館'], remind_month: 2, due_hint: '3/31 前', description: '特殊活動日的壓房確認。' },
  { period: 'year', category: '員工體檢', title: '正職員工年度體檢', remind_month: 3, due_hint: '4 月底前', description: '統計在職滿一年的正職人數，聯繫健康所報價後給公司確認。' },
  { period: 'year', category: '公部門', title: '政府聯合稽查與安檢', remind_month: 3, due_hint: '4/30 前', description: '相關資料備查與確認。' },
  { period: 'year', category: '公部門', title: '建物安全通知書更新', remind_month: 4, due_hint: '5/31 前' },
  { period: 'year', category: '消防／建物', title: '上半年消防／建物安全檢查', remind_month: 5, due_hint: '6/1 前', description: '上半年、下半年各一次，事先準備。' },
  { period: 'year', category: '消防／建物', title: '下半年消防／建物安全檢查', remind_month: 11, due_hint: '12/1 前', description: '上半年、下半年各一次，事先準備。' },
  { period: 'year', category: '備品', title: '過年前布巾數量確認與叫貨', remind_month: 9, due_hint: '9/30 前', description: '1. 盤點後盡量讓布巾維持三轉；確認需要的數量後請品寬報價，請示公司確認後再叫貨\n2. 跟洗衣廠確認過年的配合方式' },
  { period: 'year', category: '合約', title: '停車場合約續約', branches: ['台東1館'], remind_month: 10, due_hint: '11/15 前', description: '聯繫目前的停車場窗口，詢問續約事宜。' },
  { period: 'year', category: '開放訂房', title: '開放隔年訂房', remind_month: 6, description: '由總公司處理串接及開放，經理負責確認：\n1. 保留房、公務機房的庫存\n2. 特殊活動日（市集、活動、鐵人賽等）的壓房' },
];

// routine_items 是空的才匯入；回傳 { created, skipped, missingBranches }
function seedRoutineItems_() {
  if (Db.all('routine_items').length > 0) return { created: 0, skipped: true, missingBranches: [] };
  const byName = {};
  Db.all('branches').forEach(function (b) { byName[b.name] = b.id; });
  const missing = {};
  const rows = ROUTINE_SEED.map(function (seed, i) {
    const ids = (seed.branches || []).map(function (name) {
      if (!byName[name]) missing[name] = true;
      return byName[name];
    }).filter(Boolean);
    // 指定的部門一個都找不到時先停用，不然會變成「所有部門」都要做
    const orphan = (seed.branches || []).length > 0 && ids.length === 0;
    return {
      audience: 'manager',
      period: seed.period,
      category: seed.category,
      title: seed.title,
      description: seed.description || '',
      report_hint: seed.report_hint || '',
      branch_ids: ids.join(','),
      times: seed.times || 1,
      due_weekday: seed.period === 'week' ? (seed.due_weekday || 7) : null,
      start_day: seed.period === 'month' ? (seed.start_day || 1) : null,
      due_day: seed.period === 'month' ? (seed.due_day || 31) : null,
      steps: seed.steps || '',
      remind_month: seed.period === 'year' ? seed.remind_month : null,
      due_hint: seed.due_hint || '',
      sort_order: (i + 1) * 10,
      is_active: !orphan,
      updated_by: 'seed',
    };
  });
  Db.insert('routine_items', rows);
  return { created: rows.length, skipped: false, missingBranches: Object.keys(missing) };
}

// 試算表選單：匯入主管例行任務
function menuSeedRoutineItems() {
  const ui = SpreadsheetApp.getUi();
  ensureSchema_();
  const answer = ui.alert(
    '匯入主管例行任務',
    '會匯入 ' + ROUTINE_SEED.length + ' 項主管例行任務（週、月、年）。\n' +
    '只有在「routine_items」分頁是空的時候才會匯入；匯入後請在網頁的「例行任務設定」修改。\n\n要繼續嗎？',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer !== ui.Button.OK) return;
  const result = seedRoutineItems_();
  if (result.skipped) {
    ui.alert('沒有匯入', '「routine_items」分頁已經有任務了，為了不重複，這次沒有匯入。', ui.ButtonSet.OK);
    return;
  }
  ui.alert('匯入完成', '已匯入 ' + result.created + ' 項例行任務。' +
    (result.missingBranches.length ? '\n\n找不到這些部門，只屬於這些部門的任務先停用，請到網頁的「例行任務設定」調整：' + result.missingBranches.join('、') : ''),
    ui.ButtonSet.OK);
}
