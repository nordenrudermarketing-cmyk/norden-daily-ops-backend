// ============================================================
// 試算表讀寫的共用函式（取代原本的 supabase.from(...)）
//
//   Db.all('staff')                         全部資料（陣列，每筆是一個物件）
//   Db.where('staff', { branch_id: x })     條件篩選（物件＝欄位相等；也可以傳函式）
//   Db.first('staff', { id: x })            第一筆，找不到回 null
//   Db.insert('staff', { ... })             新增，沒給 id 會自動產生 UUID
//   Db.update('staff', { id: x }, { ... })  修改符合條件的資料，回傳修改後的資料
//   Db.upsert('t', ['a', 'b'], { ... })     依 a+b 找，有就改、沒有就新增
//   Db.remove('staff', { id: x })           刪除，回傳刪了幾筆
//
// 同一次呼叫裡同一張表只讀一次（記憶體快取）；寫入一律排隊（LockService），
// 排到之後重新讀一次最新資料再改，避免兩個人同時寫入互相蓋掉。
// ============================================================

let DB_CACHE_ = {};
let DB_SPREADSHEET_ = null;
// 這次呼叫讀寫試算表的次數與花費時間（測試站右下角會顯示，用來找出哪裡慢）
let DB_STATS_ = { reads: 0, readMs: 0, writes: 0, writeMs: 0 };

// 資料庫就是這支程式所在的試算表。
// 網頁呼叫時有時候拿不到「目前的試算表」，所以 Setup 會把試算表 ID 記在指令碼屬性 DB_ID 當備援。
function getDb_() {
  if (DB_SPREADSHEET_) return DB_SPREADSHEET_;
  DB_SPREADSHEET_ = SpreadsheetApp.getActiveSpreadsheet();
  if (!DB_SPREADSHEET_) {
    const id = PropertiesService.getScriptProperties().getProperty('DB_ID');
    if (!id) throw new Error('找不到資料庫試算表，請先在試算表選單按「路得系統 → 檢查資料表結構」');
    DB_SPREADSHEET_ = SpreadsheetApp.openById(id);
  }
  return DB_SPREADSHEET_;
}

function nowIso_() {
  return new Date().toISOString();
}

// ---------- 型別轉換 ----------

function fromCell_(value, type) {
  if (value === '' || value === null || value === undefined) return null;
  if (value instanceof Date) {
    // 有人手動輸入日期時，試算表會把它變成日期物件；轉回文字
    const hasTime = value.getHours() || value.getMinutes() || value.getSeconds();
    value = Utilities.formatDate(value, 'Asia/Taipei', hasTime ? "yyyy-MM-dd'T'HH:mm:ssXXX" : 'yyyy-MM-dd');
  }
  if (type === 'bool') {
    if (value === true || value === false) return value;
    return /^(true|t|1|是|yes)$/i.test(String(value).trim());
  }
  if (type === 'number') {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return String(value);
}

function toCell_(value) {
  if (value === null || value === undefined) return '';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ---------- 讀取 ----------

function sheetOf_(table) {
  if (!SCHEMA[table]) throw new Error('程式裡沒有定義這張表：' + table);
  const sheet = getDb_().getSheetByName(table);
  if (!sheet) throw new Error('試算表裡找不到「' + table + '」分頁，請在試算表選單按「路得系統 → 檢查資料表結構」');
  return sheet;
}

// ---------- 跨呼叫的快取 ----------
// 讀一次試算表大約要 0.3～0.4 秒，每個 API 又要讀好幾張表（例如驗證身分就要讀 staff、roles），
// 所以把讀過的表放進 CacheService（Google 提供的暫存區）10 分鐘，下一次呼叫直接拿。
// 寫入時一定先清掉快取、並且直接讀試算表（不走快取），所以不會用舊資料去改。
// 有人直接在試算表上手動修改時，onEdit（Setup.gs）會清掉那張表的快取。
// 只快取 Schema.gs 標 cache: true 的表（很少改、每次都要讀的：館別、職務、同仁、題目、功能開關）；
// 自評表這種常常有人寫入的表不快取，避免看到幾秒前的舊資料。單一快取值上限 100KB，放不下就不快取。
const TABLE_CACHE_SECONDS = 600;

function tableCacheKey_(table) {
  return 'tbl_v1_' + table;
}

function clearTableCache_(table) {
  delete DB_CACHE_[table];
  CacheService.getScriptCache().remove(tableCacheKey_(table));
}

// 回傳 { sheet, headers, records: [{ row: 試算表第幾列, data: {...} }] }
// sheet 一開始可能是 null（從快取來的），要用的時候再拿
function load_(table, fresh) {
  if (!fresh && DB_CACHE_[table]) return DB_CACHE_[table];
  const cacheable = !!SCHEMA[table].cache;
  if (!fresh && cacheable) {
    const cached = CacheService.getScriptCache().get(tableCacheKey_(table));
    if (cached) {
      const parsed = JSON.parse(cached);
      DB_CACHE_[table] = { sheet: null, headers: parsed.headers, records: parsed.records };
      return DB_CACHE_[table];
    }
  }
  const started = Date.now();
  const sheet = sheetOf_(table);
  const values = sheet.getDataRange().getValues();
  DB_STATS_.reads++;
  DB_STATS_.readMs += Date.now() - started;
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  const types = SCHEMA[table].columns;
  const records = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (v) { return v === '' || v === null; })) continue;
    const data = {};
    headers.forEach(function (h, c) {
      if (h) data[h] = fromCell_(row[c], types[h] || 'text');
    });
    records.push({ row: i + 1, data: data });
  }
  DB_CACHE_[table] = { sheet: sheet, headers: headers, records: records };
  if (cacheable) try {
    CacheService.getScriptCache().put(tableCacheKey_(table), JSON.stringify({ headers: headers, records: records }), TABLE_CACHE_SECONDS);
  } catch (e) {
    // 放不進快取就算了，下次照常讀試算表
  }
  return DB_CACHE_[table];
}

function matcher_(filter) {
  if (typeof filter === 'function') return filter;
  if (!filter) return function () { return true; };
  const keys = Object.keys(filter);
  return function (r) {
    return keys.every(function (k) { return toCell_(r[k]) === toCell_(filter[k]); });
  };
}

function copy_(obj) {
  return Object.assign({}, obj);
}

// 寫入排隊；寫完 flush 確定資料進了試算表，再清一次快取，避免別人剛好在這之間把舊資料放回快取。
// 在 Db.transaction 裡面的寫入共用同一次排隊與 flush（見下方 transaction）。
let LOCK_DEPTH_ = 0;
let LOCK_TABLES_ = [];

function withLock_(table, fn) {
  if (LOCK_DEPTH_ > 0) {
    if (LOCK_TABLES_.indexOf(table) < 0) LOCK_TABLES_.push(table);
    return fn();
  }
  return runLocked_([table], fn);
}

function runLocked_(tables, fn) {
  const started = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  LOCK_DEPTH_ = 1;
  LOCK_TABLES_ = tables.slice();
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    LOCK_TABLES_.forEach(clearTableCache_);
    LOCK_DEPTH_ = 0;
    LOCK_TABLES_ = [];
    lock.releaseLock();
    DB_STATS_.writes++;
    DB_STATS_.writeMs += Date.now() - started;
  }
}

// ---------- 只讀「相關的那幾列」 ----------
// 作答紀錄這種表每個月會多上千列，每次都整張讀會越來越慢。
// 這裡先用試算表的「尋找」功能找出某一欄等於某個值的列（例如某份自評表的所有答案），
// 再只讀「第一個找到的列～最後一個找到的列」這一塊。
// 回傳的 records 包含這一塊裡的所有列（寫回時才不會蓋掉中間其他人的資料），呼叫的人自己再篩選。
function scopedLoad_(table, column, value) {
  const started = Date.now();
  const sheet = sheetOf_(table);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  const col = headers.indexOf(column) + 1;
  if (col < 1) throw new Error('「' + table + '」分頁沒有「' + column + '」欄位');
  const records = [];
  if (lastRow > 1 && value !== null && value !== undefined && value !== '') {
    const rows = sheet.getRange(2, col, lastRow - 1, 1).createTextFinder(String(value)).matchEntireCell(true)
      .findAll().map(function (r) { return r.getRow(); });
    if (rows.length) {
      const first = Math.min.apply(null, rows);
      const last = Math.max.apply(null, rows);
      const types = SCHEMA[table].columns;
      sheet.getRange(first, 1, last - first + 1, lastCol).getValues().forEach(function (row, i) {
        if (row.every(function (v) { return v === '' || v === null; })) return;
        const data = {};
        headers.forEach(function (h, c) { if (h) data[h] = fromCell_(row[c], types[h] || 'text'); });
        records.push({ row: first + i, data: data });
      });
    }
  }
  DB_STATS_.reads++;
  DB_STATS_.readMs += Date.now() - started;
  return { sheet: sheet, headers: headers, records: records };
}

// 寫入時要讀的資料：有指定 scope 就只讀相關的列，否則整張讀（都不走快取）
function loadForWrite_(table, opts) {
  const scope = opts && opts.scope;
  return scope ? scopedLoad_(table, scope.column, scope.value) : load_(table, true);
}

// 把改過的資料寫回試算表。changed：[{ row, data }]（record.data 已經是改好的內容）
// 改的列少就一列一列寫；多的話把「第一列到最後一列」整塊一次寫回，比較快
function writeRecords_(t, changed) {
  if (changed.length === 0) return;
  const toValues = function (data) { return t.headers.map(function (h) { return toCell_(data[h]); }); };
  if (changed.length <= 3) {
    changed.forEach(function (r) { t.sheet.getRange(r.row, 1, 1, t.headers.length).setValues([toValues(r.data)]); });
    return;
  }
  const rows = changed.map(function (r) { return r.row; });
  const first = Math.min.apply(null, rows);
  const last = Math.max.apply(null, rows);
  const byRow = {};
  t.records.forEach(function (r) { byRow[r.row] = r.data; });
  changed.forEach(function (r) { byRow[r.row] = r.data; });
  const blank = t.headers.map(function () { return ''; });
  const values = [];
  for (let n = first; n <= last; n++) values.push(byRow[n] ? toValues(byRow[n]) : blank);
  t.sheet.getRange(first, 1, values.length, t.headers.length).setValues(values);
}

// 試算表預設只有 1000 列，超過的地方不能直接寫，要先加列
function ensureRows_(sheet, lastRowNeeded) {
  const max = sheet.getMaxRows();
  if (lastRowNeeded > max) sheet.insertRowsAfter(max, lastRowNeeded - max);
}

function appendRecords_(t, list) {
  if (list.length === 0) return;
  const start = t.sheet.getLastRow() + 1;
  ensureRows_(t.sheet, start + list.length - 1);
  const values = list.map(function (data) {
    return t.headers.map(function (h) { return toCell_(data[h]); });
  });
  const range = t.sheet.getRange(start, 1, values.length, t.headers.length);
  range.setNumberFormat('@');
  range.setValues(values);
}

// 新增時自動補上 id、建立／更新時間
function withDefaults_(t, row, now) {
  const data = copy_(row);
  if (t.headers.indexOf('id') >= 0 && !data.id) data.id = Utilities.getUuid();
  if (t.headers.indexOf('created_at') >= 0 && !data.created_at) data.created_at = now;
  if (t.headers.indexOf('updated_at') >= 0 && !data.updated_at) data.updated_at = now;
  return data;
}

const Db = {
  all: function (table) {
    return load_(table).records.map(function (r) { return copy_(r.data); });
  },

  where: function (table, filter) {
    const match = matcher_(filter);
    return load_(table).records.filter(function (r) { return match(r.data); }).map(function (r) { return copy_(r.data); });
  },

  // 某一欄等於某個值的資料。大表（例如作答紀錄）用這個比 where 快：只讀相關的列
  whereEq: function (table, column, value) {
    const t = DB_CACHE_[table] || scopedLoad_(table, column, value);
    return t.records
      .filter(function (r) { return toCell_(r.data[column]) === toCell_(value); })
      .map(function (r) { return copy_(r.data); });
  },

  // 把好幾個寫入包成一次：只排隊一次、最後只 flush 一次（例如自評表＋它的答案一起存）
  transaction: function (fn) {
    if (LOCK_DEPTH_ > 0) return fn();
    return runLocked_([], fn);
  },

  first: function (table, filter) {
    const match = matcher_(filter);
    const found = load_(table).records.find(function (r) { return match(r.data); });
    return found ? copy_(found.data) : null;
  },

  insert: function (table, rows) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (list.length === 0) return [];
    return withLock_(table, function () {
      const t = load_(table, true);
      const now = nowIso_();
      const prepared = list.map(function (r) { return withDefaults_(t, r, now); });
      appendRecords_(t, prepared);
      clearTableCache_(table);
      return prepared.map(copy_);
    });
  },

  update: function (table, filter, patch) {
    const match = matcher_(filter);
    return withLock_(table, function () {
      const t = load_(table, true);
      const changed = [];
      t.records.forEach(function (r) {
        if (!match(r.data)) return;
        r.data = Object.assign(copy_(r.data), patch);
        changed.push(r);
      });
      writeRecords_(t, changed);
      clearTableCache_(table);
      return changed.map(function (r) { return copy_(r.data); });
    });
  },

  // 依 id 一次改很多筆，每筆改的內容不同：{ id1: {...}, id2: {...} }
  // opts.scope = { column, value }：只讀相關的列（見 scopedLoad_）
  updateById: function (table, patchesById, opts) {
    if (Object.keys(patchesById).length === 0) return [];
    return withLock_(table, function () {
      const t = loadForWrite_(table, opts);
      const changed = [];
      t.records.forEach(function (r) {
        const patch = patchesById[r.data.id];
        if (!patch) return;
        r.data = Object.assign(copy_(r.data), patch);
        changed.push(r);
      });
      writeRecords_(t, changed);
      clearTableCache_(table);
      return changed.map(function (r) { return copy_(r.data); });
    });
  },

  // keyCols：用來判斷「是不是同一筆」的欄位，例如 ['staff_id', 'eval_month']
  // opts.scope = { column, value }：只讀相關的列（見 scopedLoad_），keyCols 要包含這個欄位
  // opts.guard(現有資料或 null)：寫入前在排隊中檢查最新資料，不符合就丟錯誤中止
  upsert: function (table, keyCols, rows, opts) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (list.length === 0) return [];
    return withLock_(table, function () {
      const t = loadForWrite_(table, opts);
      const now = nowIso_();
      const keyOf = function (obj) { return keyCols.map(function (k) { return toCell_(obj[k]); }).join('\u0001'); };
      const index = {};
      t.records.forEach(function (rec) { index[keyOf(rec.data)] = rec; });

      const result = [];
      const changed = [];
      const toInsert = [];
      if (opts && opts.guard) list.forEach(function (r) { const f = index[keyOf(r)]; opts.guard(f ? copy_(f.data) : null); });
      list.forEach(function (r) {
        const found = index[keyOf(r)];
        if (found) {
          found.data = Object.assign(copy_(found.data), r);
          if (t.headers.indexOf('updated_at') >= 0 && !('updated_at' in r)) found.data.updated_at = now;
          if (changed.indexOf(found) < 0) changed.push(found);
          result.push(found.data);
        } else {
          const data = withDefaults_(t, r, now);
          toInsert.push(data);
          result.push(data);
        }
      });
      writeRecords_(t, changed);
      appendRecords_(t, toInsert);
      clearTableCache_(table);
      return result.map(copy_);
    });
  },

  remove: function (table, filter) {
    const match = matcher_(filter);
    return withLock_(table, function () {
      const t = load_(table, true);
      // 從下往上刪，前面的列號才不會跑掉
      const rowsToDelete = t.records.filter(function (r) { return match(r.data); })
        .map(function (r) { return r.row; })
        .sort(function (a, b) { return b - a; });
      rowsToDelete.forEach(function (n) { t.sheet.deleteRow(n); });
      clearTableCache_(table);
      return rowsToDelete.length;
    });
  },
};

// ---------- 常用的關聯查詢（原本 Supabase 的 roles(name, category) 這類寫法） ----------

function roleById_(roleId) {
  const role = roleId ? Db.first('roles', { id: roleId }) : null;
  return role ? { name: role.name, category: role.category, template_category: role.template_category } : null;
}

function branchById_(branchId) {
  return branchId ? Db.first('branches', { id: branchId }) : null;
}

// 照中文筆畫排序（跟原本 localeCompare(..., 'zh-Hant') 一樣）
function byName_(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
}
