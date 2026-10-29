// ============================================================
// 試算表上方的「路得系統」選單
//
//   檢查資料表結構     依 Schema.gs 建立缺少的分頁、補上缺少的欄位（不會刪任何東西）
//   從 Supabase 備份匯入 把「路得系統_Supabase備份」試算表的資料搬進來（會覆蓋目前資料）
//   從正式站同步最新資料 只有測試站才有：把「路得系統（正式）」的最新資料複製過來（正式站只讀不改）
//   顯示系統網址       目前部署的網頁網址
//
// 第一次使用任何一個選單項目時，Google 會要求授權，選 office.hq 帳號並允許即可。
// ============================================================

// 正式站的資料庫（試算表「路得系統（正式）」）。只有測試站的「從正式站同步最新資料」會讀它，不會寫入
const PRODUCTION_DB_ID = '1BfEGZiD4bAvd_s1LA1vZz50Qj_vedQe8Uv4PUL0_Xsk';

function onOpen() {
  const menu = SpreadsheetApp.getUi()
    .createMenu('路得系統')
    .addItem('檢查資料表結構', 'menuEnsureSchema')
    .addItem('從 Supabase 備份匯入資料', 'menuImportFromBackup');
  if (isStaging_()) menu.addItem('從正式站同步最新資料', 'menuSyncFromProduction');
  menu.addSeparator()
    .addItem('顯示系統網址', 'menuShowUrl')
    .addToUi();
}

// 有人直接在試算表上修改資料時（例如改館別名稱、改題目），清掉那張表的快取，網頁馬上看得到
function onEdit(e) {
  const table = e && e.range ? e.range.getSheet().getName() : null;
  if (table && SCHEMA[table]) clearTableCache_(table);
  if (table === 'feature_toggles') CacheService.getScriptCache().remove(FEATURE_CACHE_KEY);
}

function menuEnsureSchema() {
  const report = ensureSchema_();
  SpreadsheetApp.getUi().alert('資料表結構檢查完成', report.join('\n') || '全部正確，沒有需要調整的地方。', SpreadsheetApp.getUi().ButtonSet.OK);
}

function ensureSchema_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('DB_ID', ss.getId());
  const report = [];

  Object.keys(SCHEMA).forEach(function (table) {
    const def = SCHEMA[table];
    const wanted = Object.keys(def.columns);
    let sheet = ss.getSheetByName(table);
    if (!sheet) {
      sheet = ss.insertSheet(table);
      report.push('新增分頁：' + table);
    }
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); }).filter(Boolean);
    const missing = wanted.filter(function (c) { return existing.indexOf(c) < 0; });
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      if (existing.length) report.push(table + ' 補上欄位：' + missing.join('、'));
    }
    const width = existing.length + missing.length;
    // 整欄設成純文字，之後新增的資料也不會被試算表自動轉成數字或日期
    sheet.getRange(1, 1, sheet.getMaxRows(), width).setNumberFormat('@');
    sheet.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#e8eaed');
    sheet.setFrozenRows(1);
    sheet.setTabColor(def.manual ? '#4a86e8' : null);
  });

  // 新試算表預設的空白分頁用不到，拿掉
  ['工作表1', 'Sheet1'].forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
      report.push('刪除空白分頁：' + name);
    }
  });
  return report;
}

function menuImportFromBackup() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.prompt(
    '從 Supabase 備份匯入資料',
    '請貼上「路得系統_Supabase備份」試算表的網址：\n\n' +
    '⚠ 這會用備份內容「覆蓋」目前這份試算表裡的：\n' + Object.keys(SCHEMA).join('、'),
    ui.ButtonSet.OK_CANCEL
  );
  if (answer.getSelectedButton() !== ui.Button.OK) return;

  const match = answer.getResponseText().match(/[-\w]{25,}/);
  if (!match) {
    ui.alert('看不出試算表 ID，請貼上完整網址（https://docs.google.com/spreadsheets/d/…）');
    return;
  }
  const report = importFromBackup_(match[0]);
  ui.alert('匯入完成', report.join('\n'), ui.ButtonSet.OK);
}

// 測試站專用：把正式站的最新資料複製過來，方便用最新、最真實的資料測試或除錯。
// 測試帳號（只存在測試站）會保留；密碼不複製（正式站的密碼存在正式站的指令碼屬性，這裡讀不到），
// 測試站已經有密碼的人沿用測試站密碼，新帳號第一次登入時輸入的密碼就是他在測試站的密碼。
function menuSyncFromProduction() {
  const ui = SpreadsheetApp.getUi();
  if (!isStaging_()) {
    ui.alert('這個功能只能在測試站（試算表名稱含「測試」）使用，避免把正式資料蓋掉。');
    return;
  }
  const answer = ui.alert(
    '從正式站同步最新資料',
    '會把「路得系統（正式）」的最新資料複製到這份測試試算表，覆蓋這裡的：\n' + Object.keys(SCHEMA).join('、') + '\n\n' +
    '・測試帳號（登入代碼 T- 開頭、名字有「測試」）會保留\n' +
    '・密碼不會複製：測試站已經有密碼的人沿用測試站的密碼；新帳號第一次登入時輸入的密碼，就是他在測試站的密碼\n' +
    '・正式站的資料只會被讀取，不會被修改\n\n要繼續嗎？',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer !== ui.Button.OK) return;
  const report = importFromBackup_(PRODUCTION_DB_ID, { keepTestAccounts: true });
  ui.alert('同步完成', report.join('\n'), ui.ButtonSet.OK);
}

// opts.keepTestAccounts：staff 表保留這份試算表裡、來源沒有的測試帳號（測試站同步正式站資料時用）
function importFromBackup_(backupId, opts) {
  ensureSchema_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (backupId === ss.getId()) throw new Error('來源和目前這份是同一份試算表，不能自己匯入自己');
  const backup = SpreadsheetApp.openById(backupId);
  const report = [];

  Object.keys(SCHEMA).forEach(function (table) {
    const source = backup.getSheetByName(table);
    if (!source) {
      report.push(table + '：備份裡沒有這個分頁，略過');
      return;
    }
    const values = source.getDataRange().getValues();
    const srcHeaders = (values[0] || []).map(function (h) { return String(h).trim(); });
    // 備份程式遇到空表會寫「（沒有資料）」
    const rows = srcHeaders[0] === '（沒有資料）' ? [] : values.slice(1).filter(function (r) {
      return r.some(function (v) { return v !== ''; });
    });

    const sheet = ss.getSheetByName(table);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    const colIndex = {};
    srcHeaders.forEach(function (h, i) { colIndex[h] = i; });

    // 密碼雜湊不進試算表，改存到指令碼屬性
    if (table === 'staff' && colIndex.password_hash !== undefined) {
      const pw = {};
      rows.forEach(function (r) {
        const id = String(r[colIndex.id] || '');
        const hash = String(r[colIndex.password_hash] || '');
        if (id && hash) pw['PW_' + id] = hash;
      });
      PropertiesService.getScriptProperties().setProperties(pw, false);
      report.push('密碼：' + Object.keys(pw).length + ' 位同仁的密碼已搬到指令碼屬性');
    }

    const out = rows.map(function (r) {
      return headers.map(function (h) {
        const i = colIndex[h];
        return i === undefined || r[i] === null ? '' : String(r[i]);
      });
    });

    // 只存在這份試算表的測試帳號（來源沒有）：先記下來，覆蓋後再放回去
    let kept = 0;
    if (opts && opts.keepTestAccounts && table === 'staff') {
      const sourceIds = {};
      rows.forEach(function (r) { sourceIds[String(r[colIndex.id])] = true; });
      load_('staff', true).records
        .filter(function (rec) { return isTestAccount_(rec.data) && !sourceIds[rec.data.id]; })
        .forEach(function (rec) {
          out.push(headers.map(function (h) { return toCell_(rec.data[h]); }));
          kept++;
        });
    }

    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
    if (out.length) {
      ensureRows_(sheet, out.length + 1);
      const range = sheet.getRange(2, 1, out.length, headers.length);
      range.setNumberFormat('@');
      range.setValues(out);
    }
    const dropped = srcHeaders.filter(function (h) { return h && h !== 'password_hash' && headers.indexOf(h) < 0; });
    report.push(table + '：' + rows.length + ' 筆' + (kept ? '（另外保留測試帳號 ' + kept + ' 個）' : '') +
      (dropped.length ? '（沒搬的欄位：' + dropped.join('、') + '）' : ''));
  });

  Object.keys(SCHEMA).forEach(clearTableCache_);
  CacheService.getScriptCache().remove(FEATURE_CACHE_KEY);
  return report;
}

function menuShowUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('系統網址', url || '還沒有部署網頁應用程式', SpreadsheetApp.getUi().ButtonSet.OK);
}
