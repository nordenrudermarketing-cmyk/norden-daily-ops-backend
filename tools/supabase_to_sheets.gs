// ============================================================
// 路得系統｜把 Supabase 的資料整批複製到這份 Google 試算表
//
// 用法（只需要做一次設定）：
//   1. 用 office.hq 帳號建一份新的試算表 → 擴充功能 → Apps Script
//   2. 把這整個檔案貼進「程式碼.gs」，存檔
//   3. 左邊齒輪「專案設定」→ 最下面「指令碼屬性」新增：
//        SUPABASE_URL     https://xxxxx.supabase.co
//        SUPABASE_KEY     service_role 金鑰（eyJ… 或 sb_secret_… 都可以）
//        SUPABASE_SCHEMA  public（正式資料；要抓測試資料就填 staging，不填就是 public）
//   4. 回到試算表重新整理，上方會多一個「Supabase 匯入」選單 →「匯入全部資料表」
//
// 每張資料表變成一個分頁，另外有一個「匯入目錄」分頁記錄每張表的筆數與注意事項。
// 所有儲存格都存成「純文字」，避免 Google 試算表自作主張：
// 例如登入代碼 0012 被變成數字 12、日期被換成別的格式。
//
// 一次執行最多跑 5 分鐘（Apps Script 上限是 6 分鐘），沒跑完的話再按一次會從中斷的地方接著做。
// 想全部重來就按「清除進度（下次從頭匯入）」。
//
// ⚠ 匯入完成後，記得回「指令碼屬性」把 SUPABASE_KEY 刪掉。
// ============================================================

// 從程式碼與 SQL 檔整理出來的資料表清單。
// 優先向 Supabase 查詢「實際有哪些表」，查不到時才用這份清單（最早的 schema_v2.sql 不在 repo 裡，可能有遺漏）。
const FALLBACK_TABLES = [
  'adhoc_task_assignments', 'adhoc_tasks', 'anomaly_logs', 'assessment_stage_evaluations',
  'bonus_appeals', 'bonus_settings', 'branches', 'daily_bonus_summary', 'daily_reflections',
  'daily_team_leads', 'deep_clean_assignments', 'deep_clean_task_templates', 'defect_logs',
  'feature_toggles', 'floor_owners', 'hq_tasks', 'learning_paths', 'learning_unit_assignments',
  'learning_units', 'manager_memo_items', 'manager_shift_reports', 'manager_task_completions',
  'manager_task_templates', 'manager_worksheet_answers', 'manager_worksheet_submissions',
  'manager_worksheet_templates', 'no_show_daily_logs', 'no_show_records', 'order_sweep_logs',
  'order_sweep_notes', 'paint_inspections', 'practical_exams',
  'public_area_maintenance_completions', 'public_area_maintenance_templates', 'review_checks',
  'review_daily_logs', 'roles', 'room_cleanings', 'room_maintenance_completions',
  'room_maintenance_templates', 'rooms', 'routine_tasks', 'schedule_blackout_dates',
  'schedule_settings', 'self_eval_answers', 'self_eval_submissions', 'self_eval_templates',
  'shift_handover_reports', 'shift_task_completions', 'shift_task_focus_notes',
  'shift_task_templates', 'staff', 'staff_cleaning_completions', 'staff_cleaning_templates',
  'staff_learning_progress', 'staff_schedule', 'weekly_goals', 'written_exam_answers',
  'written_exam_attempts', 'written_exam_questions', 'written_exam_results', 'zone_owners',
];

const PAGE_SIZE = 1000;            // Supabase 一次最多回 1000 筆
const CELL_LIMIT = 50000;          // Google 試算表一格最多 5 萬字元（base64 照片常常超過）
const TIME_LIMIT_MS = 5 * 60 * 1000;
const INDEX_SHEET = '匯入目錄';
const DONE_KEY = 'IMPORT_DONE_TABLES';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Supabase 匯入')
    .addItem('檢查連線設定', 'checkConnection')
    .addItem('匯入全部資料表', 'importAll')
    .addItem('清除進度（下次從頭匯入）', 'resetProgress')
    .addToUi();
}

// 匯入前先確認金鑰種類對不對、讀不讀得到 staff 表。
// 只顯示金鑰「種類」，不顯示金鑰內容。
function checkConnection() {
  const cfg = readConfig_();
  const lines = [`金鑰種類：${describeKey_(cfg.key).label}`, `schema：${cfg.schema}`];

  const spec = UrlFetchApp.fetch(cfg.url + '/rest/v1/', { headers: headers_(cfg), muteHttpExceptions: true });
  lines.push(`查詢資料表清單：HTTP ${spec.getResponseCode()}${spec.getResponseCode() === 200 ? '（成功）' : '（失敗）'}`);

  const staff = UrlFetchApp.fetch(cfg.url + '/rest/v1/staff?select=id&limit=1', {
    headers: Object.assign({ Prefer: 'count=exact' }, headers_(cfg)),
    muteHttpExceptions: true,
  });
  const range = staff.getHeaders()['Content-Range'] || staff.getHeaders()['content-range'] || '';
  lines.push(`staff 表：HTTP ${staff.getResponseCode()}，共 ${range.split('/')[1] || '?'} 筆`);

  SpreadsheetApp.getUi().alert('連線檢查結果', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

// 判斷金鑰種類。anon／publishable 金鑰會被資料表的權限規則（RLS）擋住，
// Supabase 不會報錯，而是「回傳 0 筆」——表格全部空白就是這個原因。
function describeKey_(key) {
  if (key.startsWith('sb_secret_')) return { ok: true, label: '新式 secret 金鑰（正確）' };
  if (key.startsWith('sb_publishable_')) return { ok: false, label: '新式 publishable 公開金鑰（錯誤：權限不足，會讀到 0 筆）' };
  if (key.startsWith('eyJ')) {
    let role = '無法判讀';
    try {
      // 舊式金鑰是 JWT，中間那一段記載這把鑰匙的角色（不是機密內容）
      let part = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (part.length % 4) part += '=';
      role = JSON.parse(Utilities.newBlob(Utilities.base64Decode(part)).getDataAsString()).role;
    } catch (e) { /* 判讀失敗就照實顯示 */ }
    if (role === 'service_role') return { ok: true, label: '舊式 service_role 金鑰（正確）' };
    return { ok: false, label: `舊式 ${role} 金鑰（錯誤：權限不足，會讀到 0 筆，要用 service_role）` };
  }
  return { ok: false, label: '看不出是哪一種金鑰（可能貼錯或多貼了字）' };
}

function importAll() {
  const started = Date.now();
  const cfg = readConfig_();
  const keyInfo = describeKey_(cfg.key);
  if (!keyInfo.ok) throw new Error(`SUPABASE_KEY 是${keyInfo.label}。請改貼 service_role（或 sb_secret_）金鑰後，先按「清除進度」再重新匯入。`);
  const props = PropertiesService.getScriptProperties();
  const done = JSON.parse(props.getProperty(DONE_KEY) || '[]');
  const tables = listTables_(cfg);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  for (const table of tables.names) {
    if (done.includes(table)) continue;
    if (Date.now() - started > TIME_LIMIT_MS) {
      ss.toast(`已完成 ${done.length}／${tables.names.length} 張，時間快到了，請再按一次「匯入全部資料表」繼續`, '還沒跑完', 30);
      return;
    }
    const result = importTable_(cfg, ss, table);
    writeIndexRow_(ss, table, result, tables.source);
    done.push(table);
    props.setProperty(DONE_KEY, JSON.stringify(done));
  }
  // staff 表一定有人（不然沒人能登入），讀到 0 筆代表權限或連線有問題，不是真的沒資料
  const staffSheet = ss.getSheetByName('staff');
  if (staffSheet && staffSheet.getLastRow() < 2) {
    ss.toast('staff 表讀到 0 筆，這通常代表金鑰權限不足。請按「檢查連線設定」看看。', '可能有問題', 60);
    return;
  }
  ss.toast(`全部 ${tables.names.length} 張資料表匯入完成。記得到「指令碼屬性」刪掉 SUPABASE_KEY。`, '完成', 60);
}

function resetProgress() {
  PropertiesService.getScriptProperties().deleteProperty(DONE_KEY);
  SpreadsheetApp.getActiveSpreadsheet().toast('進度已清除，下次會從頭匯入（已經匯入的分頁會被覆蓋）', '完成', 10);
}

function readConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = (props.getProperty('SUPABASE_URL') || '').trim().replace(/\/+$/, '');
  const key = (props.getProperty('SUPABASE_KEY') || '').trim();
  const schema = (props.getProperty('SUPABASE_SCHEMA') || 'public').trim();
  if (!/^https:\/\/\S+$/.test(url)) throw new Error('指令碼屬性 SUPABASE_URL 沒填或格式不對，應該長得像 https://xxxxx.supabase.co');
  if (!key) throw new Error('指令碼屬性 SUPABASE_KEY 沒填');
  return { url, key, schema };
}

function headers_(cfg) {
  const h = { apikey: cfg.key, 'Accept-Profile': cfg.schema };
  // 舊式金鑰（eyJ 開頭）要同時放在 Authorization；新式 sb_secret_ 金鑰只放 apikey 就好
  if (cfg.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + cfg.key;
  return h;
}

// 問 Supabase 這個 schema 實際有哪些表；問不到就用 FALLBACK_TABLES
function listTables_(cfg) {
  try {
    const res = UrlFetchApp.fetch(cfg.url + '/rest/v1/', { headers: headers_(cfg), muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const spec = JSON.parse(res.getContentText());
      const names = Object.keys(spec.definitions || {}).sort();
      if (names.length) return { names, source: 'Supabase 回報' };
    }
  } catch (e) {
    // 查不到就用備用清單，不中斷
  }
  return { names: FALLBACK_TABLES, source: '備用清單' };
}

function importTable_(cfg, ss, table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = UrlFetchApp.fetch(
      `${cfg.url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: headers_(cfg), muteHttpExceptions: true }
    );
    const code = res.getResponseCode();
    if (code === 404) return { rows: 0, columns: 0, note: '這個 schema 裡沒有這張表' };
    // 錯誤訊息只取前 200 字，避免把整頁錯誤寫進試算表
    if (code !== 200) return { rows: rows.length, columns: 0, note: `讀取失敗（HTTP ${code}）：${res.getContentText().slice(0, 200)}` };
    const page = JSON.parse(res.getContentText());
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // 欄位：所有資料列出現過的欄位聯集，保持第一次出現的順序
  const columns = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!columns.includes(k)) columns.push(k); }));

  let truncated = 0;
  const values = rows.map((r) => columns.map((c) => {
    const text = toCellText_(r[c]);
    if (text.length > CELL_LIMIT) {
      truncated++;
      return `[內容過長未匯入：${text.length} 字元，多半是照片]`;
    }
    return text;
  }));

  const sheet = ss.getSheetByName(table) || ss.insertSheet(table);
  sheet.clear();
  if (columns.length) {
    const all = [columns, ...values];
    const range = sheet.getRange(1, 1, all.length, columns.length);
    range.setNumberFormat('@');   // 全部當純文字，原樣保留
    range.setValues(all);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold').setBackground('#e8eaed');
    sheet.setFrozenRows(1);
  } else {
    sheet.getRange(1, 1).setValue('（沒有資料）');
  }

  const notes = [];
  if (truncated) notes.push(`${truncated} 格內容超過 5 萬字元沒匯入（多半是 base64 照片）`);
  return { rows: rows.length, columns: columns.length, note: notes.join('；') };
}

function toCellText_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function writeIndexRow_(ss, table, result, source) {
  let sheet = ss.getSheetByName(INDEX_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(INDEX_SHEET, 0);
    sheet.appendRow(['資料表', '筆數', '欄位數', '注意事項', '匯入時間', '表格清單來源']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#e8eaed');
    sheet.setFrozenRows(1);
  }
  const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  const existing = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().findIndex((r) => r[0] === table);
  const row = [table, result.rows, result.columns, result.note || '', now, source];
  if (existing > 0) sheet.getRange(existing + 1, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}
