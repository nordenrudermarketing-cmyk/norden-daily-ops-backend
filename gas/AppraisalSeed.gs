// ============================================================
// 每月評核：預設的評核類別與項目（試算表選單「匯入評核項目預設值」）
//
// 內容取自 2026-10 的 Google 評核表（職責要求、A～D 說明）與評核項目.xlsx，
// 2026-11 起「○○職務分數」「管理職務分數」統一改名「影響力分數」（重點是同事對團隊的正向影響）。
// 預設獎金基數（每 1 分多少元）：現場人員 30；主管 影響力 15、同事內評 5、客戶評價 10；品牌各 6。
//
// 只會新增「還沒有」的類別和項目（依名稱比對），已經存在的不會被改掉，所以可以重複執行。
// 職務對應：還沒指定評核類別的職務，依自評題目類別自動對應（房務→房務、客務→客務、經理職→主管），
// 其他職務（品牌、咖啡廳…）請在「評核項目設定」頁指定。
// ============================================================

const APPRAISAL_DESC_HOUSEKEEPING = [
  '房務部門應能依照路得行旅的房務流程與清潔標準，穩定完成客房、公共區域、備品補充及相關整備工作，確保每日提供乾淨、安全且符合品牌標準的住宿環境。',
  '工作執行上，應確實依照既定流程進行清潔與查房，包含確認房號、入住狀態、敲門詢問、及時回報等流程，避免因疏忽造成誤開房門、誤入旅客使用中房間、錯誤處理房內物品或造成旅客爭議、館內賠償或品牌損失。',
  '房務人員亦應具備足夠的細心度與觀察力，主動留意設備異常、清潔狀況、備品不足、房內損壞或其他可能影響入住品質的問題。發現異常時，應在合理範圍內先行處理，並依情況即時且清楚回報，避免問題延續至下一位旅客入住後才被發現。',
  '在團隊合作上，應準時出勤、配合每日房況及工作安排，若有請假或臨時異動，應主動溝通並盡可能降低對團隊及當日整房進度的影響。當房量較大、同事工作量較重或現場有臨時需求時，也應在合理範圍內相互支援，共同完成當日營運需求。',
  '工作態度上，應重視清潔品質、作業安全及工作責任，願意接受主管檢查與回饋，並持續改善容易疏忽的細節。除完成自己被分配的房間與區域外，也應逐步培養主動檢查、預防錯誤及發現問題的能力，降低返工、客訴及營運風險。',
  '整體而言，房務部門的責任在於依流程確實完成清潔、維持穩定且一致的住宿品質、保護旅客隱私與物品安全，並主動發現與回報異常，讓每一間交付給旅客的房間，都能符合路得行旅應有的清潔與安全標準。',
].join('\n\n');

const APPRAISAL_DESC_FRONTDESK = [
  '客務部門應能穩定完成日常櫃台接待、訂單處理、行政與系統操作、旅客溝通及現場問題處理，並確保各項工作符合路得行旅的服務與作業標準。',
  '工作執行上，應具備足夠的細心度與責任感，主動確認訂資訊與旅客需求，並留意訂單或顧客是否出現異常情況。遇到資料不一致、特殊需求、客訴、系統異常或其他可能影響旅客體驗與營運的狀況時，應主動查核、即時處理並依需要回報主管，避免因疏忽造成後續錯誤或營運損失。',
  '在旅客服務上，應保持親切、穩定且具彈性的溝通態度，理解旅客需求並妥善處理問題，同時熟悉館內產品、服務與相關資訊，在適當情況下具備基本的業務思維，主動提供合適的服務或建議，兼顧旅客體驗與旅館營運。',
  '身為團隊的一員，應具備責任感與團隊意識，準時出勤、妥善安排個人班務，若有請假或臨時異動，應主動溝通並盡可能降低對團隊與現場營運的影響。當現場忙碌或同事需要支援時，也應在合理範圍內主動協助，共同維持每日營運順暢。',
  '工作態度上，應理解並認同路得行旅的工作方式、品牌理念與相關規範，願意接受主管回饋並持續調整。除完成被交付的工作外，也應逐步培養主動發現問題、預防錯誤及改善工作方式的能力，避免相同錯誤重複發生。',
  '整體而言，客務部門的責任在於細心完成每一項工作、及早發現旅客與訂單異常、維持穩定的服務品質，並與團隊共同確保每日營運順暢，持續提供符合路得行旅標準的旅客體驗。',
].join('\n\n');

const APPRAISAL_DESC_MANAGEMENT = [
  '管理部門應對館內整體營運、人力安排、行政執行、團隊管理及突發狀況具備完整掌握能力，確保日常營運穩定、工作流程順暢，並能在既有資源下持續提升效率與工作品質。',
  '除完成基本管理職責外，主管應具備主動發現問題、判斷原因及提出改善方案的能力，包含合理安排人力與工作分配、維持團隊穩定、清楚傳達公司方向與工作標準、確實完成行政回報，以及在客訴、內部衝突或營運異常發生時即時處理並妥善回報。',
  '管理職務亦應具備預防與長期改善思維，能提前察覺人力、流程或營運上的潛在風險，在問題擴大前主動調整，而非僅於問題發生後處理。',
  '在團隊管理上，主管應以身作則，展現穩定、負責且正向的工作態度，主動協助團隊、建立信任與良好溝通，並在壓力或意見不同時維持理性判斷與團隊合作。',
  '整體而言，管理部門的責任在於維持營運穩定、降低問題發生、提升團隊效率，並持續優化現場與總公司之間的合作方式，讓館內能在減少總公司介入的情況下，維持良好且穩定的營運品質。',
].join('\n\n');

const APPRAISAL_DESC_CAFE = '評估咖啡廳人員在日常營運中的整體工作完成度與品質，包含飲品與餐點出餐品質、操作流程穩定度、吧台與工作區整潔，以及對設備、器具與物料的愛惜與正確使用，是否能穩定維持路得行旅的服務與品質標準。';

const APPRAISAL_SEED = [
  { group: '房務', items: [
    { name: '影響力分數', source: 'main', default_base: 30, takes_reward: true, description: APPRAISAL_DESC_HOUSEKEEPING },
  ] },
  { group: '客務', items: [
    { name: '影響力分數', source: 'main', default_base: 30, takes_reward: true, description: APPRAISAL_DESC_FRONTDESK },
  ] },
  { group: '主管', items: [
    { name: '影響力分數', source: 'main', default_base: 15, takes_reward: true, description: APPRAISAL_DESC_MANAGEMENT },
    { name: '同事內評', source: 'peer', default_base: 5, takes_reward: false,
      description: '由團隊同事進行內部評分，主要評估主管在日常管理中，是否能公平對待每位同事、主動承擔管理責任，並透過實際行動協助團隊成員達到公司的工作期待與標準。',
      grade_desc: [
        'A｜能公平對待每位同事，主動了解不同成員的工作狀況與需要，願意給予提醒、協助與適當引導，幫助每位同事理解並達到公司的工作標準與期待。面對問題時願意承擔主管責任，並持續帶動團隊共同進步。',
        'B｜能公平對待每位同事，不因個人關係或喜好而有不同標準；當同事或現場有需要時，也願意主動提供協助與支援，共同完成團隊工作。',
        'C｜能以一致的原則與標準對待每位同事，不偏袒、不針對，基本上能維持公平的管理方式，但較少主動協助、支援或進一步帶領同事成長。',
        'D｜處理工作時容易避重就輕，在團隊最需要領導的時刻缺席或將責任轉交到其他同事身上，或是責任歸屬定義不清，常以感情用事。',
      ].join('\n') },
    { name: '客戶評價', source: 'input', default_base: 10, takes_reward: false,
      description: '由總公司行政每月到各訂房平台查詢後輸入：每個平台評分超過 9 分（或 4.5 分）得 25 分。' },
  ] },
  { group: '品牌', items: [
    { name: '主動與責任承擔', source: 'main', default_base: 6, takes_reward: true,
      description: '評估對工作是否積極、能否主動面對問題並承擔責任。',
      grade_desc: 'A｜積極主動承擔任務，能提前預判問題並提出解方；展現強烈責任感。\nB｜能按指派執行並負責完成，偶有需提醒的情況。\nC｜主動性不足，需主管反覆追蹤才能推動進度。\nD｜態度消極，常延誤或忽略責任，影響團隊運作。' },
    { name: '細節與專業度', source: 'main', default_base: 6, takes_reward: false,
      description: '評估對文案、品牌名稱、排版格式、流程與資料處理等細節的重視程度。',
      grade_desc: 'A｜對細節高度敏銳，能自主檢查並維持高標準的專業表現。\nB｜大部分能維持良好品質，偶有小錯誤但態度良好並能立即修正。\nC｜細節處理時常疏忽，顯示專業度與自我要求不足。\nD｜錯誤頻繁且未改善，缺乏責任意識與專業態度。' },
    { name: '獨立解決能力', source: 'main', default_base: 6, takes_reward: false,
      description: '評估是否能在工作中展現邏輯、思考深度，以及面對問題的處理能力。',
      grade_desc: 'A｜能主動理解需求脈絡，提出建議或改善想法，具備穩定的獨立判斷能力。\nB｜大致能理解需求並依流程完成，偶需協助釐清方向。\nC｜缺乏分析與思考，僅依指示執行；遇問題容易卡關。\nD｜未經理解即交件、敷衍處理，或過度依賴主管、他人與 AI。' },
    { name: '協作與溝通', source: 'main', default_base: 6, takes_reward: false,
      description: '評估與主管、同事及跨部門合作時的態度、互動方式及溝通品質。',
      grade_desc: 'A｜積極配合並主動回報進度，溝通清楚、回應即時，能有效支持團隊。\nB｜溝通基本清楚，能與團隊協作，偶有延遲但能改善。\nC｜溝通常不夠即時或不完整，容易造成誤會或需多人補強。\nD｜抗拒協作或溝通消極，影響團隊氛圍與工作流。' },
    { name: '時間管理', source: 'main', default_base: 6, takes_reward: false,
      description: '整合工作節奏、時間規劃、可持續性與自我提升的態度。',
      grade_desc: 'A｜能良好規劃時間、保持穩定節奏，遇到挑戰也主動學習新技能並快速吸收。\nB｜多數能按時完成，工作習慣穩定；能接受回饋並持續改善。\nC｜時間掌控不佳，經常延遲或需補件；學習態度較被動。\nD｜缺乏規劃，多次延誤或未完成；抗拒學習與改進。' },
  ] },
  // 咖啡廳店經理：2026-11 使用者決定保留「管理職務分數」原名（另一項已經叫影響力分數），獎懲加在管理職務分數
  { group: '咖啡廳主管', items: [
    { name: '管理職務分數', source: 'main', default_base: 60, takes_reward: true, description: APPRAISAL_DESC_MANAGEMENT },
    { name: '影響力分數', source: 'main', default_base: 30, takes_reward: false,
      description: '評估在日常工作中，對團隊與咖啡廳營運帶來的正向影響。' },
  ] },
  { group: '咖啡廳', items: [
    { name: '影響力分數', source: 'main', default_base: 30, takes_reward: true, description: APPRAISAL_DESC_CAFE },
  ] },
];

// 依自評題目類別自動對應的評核類別
const APPRAISAL_ROLE_MAP = { housekeeping: '房務', frontdesk: '客務', management: '主管' };

function seedAppraisal_() {
  return Db.transaction(function () {
    const report = [];
    const groups = Db.all('appraisal_groups');
    const items = Db.all('appraisal_items');
    const groupIdByName = {};
    groups.forEach(function (g) { groupIdByName[g.name] = g.id; });

    APPRAISAL_SEED.forEach(function (def, gi) {
      let gid = groupIdByName[def.group];
      if (!gid) {
        gid = Db.insert('appraisal_groups', { name: def.group, sort_order: groups.length + gi + 1, is_active: true })[0].id;
        groupIdByName[def.group] = gid;
        report.push('新增評核類別：' + def.group);
      }
      def.items.forEach(function (it, ii) {
        if (items.some(function (x) { return x.group_id === gid && x.name === it.name; })) return;
        Db.insert('appraisal_items', {
          group_id: gid, name: it.name, description: it.description || '', grade_desc: it.grade_desc || '',
          source: it.source, default_base: it.default_base, takes_reward: !!it.takes_reward,
          sort_order: ii + 1, is_active: true,
        });
        report.push('　新增項目：' + def.group + '／' + it.name + '（$' + it.default_base + '）');
      });
    });

    // 只對應「有在職同仁要填自評」的職務（例如總辦公室經理不評核，就不自動對應）
    const appraisedRoles = {};
    Db.where('staff', { is_active: true }).forEach(function (s) {
      if (fillsSelfEval_(levelOf_(s))) appraisedRoles[s.role_id] = true;
    });
    const rolePatches = {};
    Db.all('roles').forEach(function (r) {
      if (r.appraisal_group_id || r.is_active === false || !appraisedRoles[r.id]) return;
      const groupName = APPRAISAL_ROLE_MAP[questionCategoryOf_(r)];
      if (groupName && groupIdByName[groupName]) {
        rolePatches[r.id] = { appraisal_group_id: groupIdByName[groupName] };
        report.push('職務「' + r.name + '」→ 評核類別「' + groupName + '」');
      }
    });
    Db.updateById('roles', rolePatches);

    const unmapped = Db.all('roles').filter(function (r) {
      return r.is_active !== false && appraisedRoles[r.id] && !r.appraisal_group_id && !rolePatches[r.id];
    }).map(function (r) { return r.name; });
    if (unmapped.length) report.push('', '還沒指定評核類別的職務（請到「評核項目設定」頁指定，不評核的可以不用管）：', unmapped.join('、'));
    if (!report.length) report.push('預設值都已經匯入過了，沒有新增任何東西。');
    return report;
  });
}

function menuSeedAppraisal() {
  const ui = SpreadsheetApp.getUi();
  ensureSchema_();
  const answer = ui.alert(
    '匯入評核項目預設值',
    '會新增房務、客務、主管、品牌、咖啡廳主管、咖啡廳六個評核類別和它們的項目（已經有的不會被改），' +
    '並把還沒設定的職務依自評題目類別對應到評核類別。可以重複執行。要繼續嗎？',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer !== ui.Button.OK) return;
  ui.alert('匯入評核項目預設值', seedAppraisal_().join('\n'), ui.ButtonSet.OK);
}
