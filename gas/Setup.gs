// ============================================================
// 試算表上方的「路得系統」選單
//
//   檢查資料表結構     依 Schema.gs 建立缺少的分頁、補上缺少的欄位（不會刪任何東西）
//   從 Supabase 備份匯入 把「路得系統_Supabase備份」試算表的資料搬進來（會覆蓋目前資料）
//   顯示系統網址       目前部署的網頁網址
//
// 第一次使用任何一個選單項目時，Google 會要求授權，選 office.hq 帳號並允許即可。
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('路得系統')
    .addItem('檢查資料表結構', 'menuEnsureSchema')
    .addItem('從 Supabase 備份匯入資料', 'menuImportFromBackup')
    .addSeparator()
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

function importFromBackup_(backupId) {
  ensureSchema_();
  const backup = SpreadsheetApp.openById(backupId);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
    if (rows.length) {
      const out = rows.map(function (r) {
        return headers.map(function (h) {
          const i = colIndex[h];
          return i === undefined || r[i] === null ? '' : String(r[i]);
        });
      });
      ensureRows_(sheet, out.length + 1);
      const range = sheet.getRange(2, 1, out.length, headers.length);
      range.setNumberFormat('@');
      range.setValues(out);
    }
    const dropped = srcHeaders.filter(function (h) { return h && h !== 'password_hash' && headers.indexOf(h) < 0; });
    report.push(table + '：' + rows.length + ' 筆' + (dropped.length ? '（沒搬的欄位：' + dropped.join('、') + '）' : ''));
  });

  Object.keys(SCHEMA).forEach(clearTableCache_);
  CacheService.getScriptCache().remove(FEATURE_CACHE_KEY);
  return report;
}

function menuShowUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('系統網址', url || '還沒有部署網頁應用程式', SpreadsheetApp.getUi().ButtonSet.OK);
}
