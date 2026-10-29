# 給 Claude 的專案說明

路得行旅（Norden）每日營運系統。飯店內部用，同仁用手機或電腦打開網頁登入使用。
**請一律用繁體中文回覆、寫註解、寫 commit 訊息**，使用者沒有工程背景。

README.md 是這個專案的**變更紀錄兼說明書**，每加一個功能就往下追加一節，內容比這份詳細。
改完功能記得也更新 README。

---

## ⚠ 正式站已經是 Google 版（Apps Script＋試算表）

2026-10-29 起同仁改用 Google 版（細節見 README 最後一節「搬到 Google Apps Script（第 1 階段）」）。
Railway 正式站設了 `REDIRECT_TO_URL`，舊網址一律跳到 Google 版、API 回 410；
Railway＋Supabase 保留 1～3 個月當退路（刪掉該變數就切回舊系統），**新功能一律做在 Google 版**。
下面「三個服務怎麼分工」以下講的是已停用的 Railway 版，只供參考。

- 擁有者帳號：Workspace `office.hq@nordenruder.com`（試算表、Apps Script、clasp 登入都是它）
- **第 1 階段**只搬正式站在用的：登入、自評表、帳號管理、功能開關。
  其他功能「要重新開放時才在 Google 版重做」，沒搬的功能在 Google 版一律關閉、不能打開
- 程式：`gas/`（後端 .gs、外框 Shell.html、轉接器 client/shim.js）＋ `tools/build_gas.py`（建置）。
  前端仍是 `public/`，靠轉接器把 `fetch('/api/...')` 和 `window.location` 換頁轉成 Apps Script 的做法
- 更新流程（clasp 要用 **PowerShell** 跑，先重新載入 PATH）：
  `python tools/build_gas.py` → `clasp -P clasp-staging.json push -f` →
  `clasp -P clasp-staging.json redeploy <部署ID> -d "說明"`（用 redeploy 網址才不會變）
- 正式站設定檔 `clasp-production.json`，**使用者說「發布」才能 push／redeploy 正式站**
- 測試站與正式站的網址、部署 ID 寫在 README；試算表名稱含「測試」＝測試站（右下角會顯示「測試站」與每次呼叫耗時）
- **新增 API**：在 `gas/Router.gs` 的 `routes_()` 加一行；**新增頁面**：加進 `build_gas.py` 的 `PAGES`；
  **功能搬過來**：`gas/Catalog.gs` 標 `ported: true`；**加欄位／表**：改 `gas/Schema.gs`，
  再請使用者在試算表選單按「路得系統 → 檢查資料表結構」
- 身分一律從登入憑證來（`req.actor`），**不要再信任網頁送來的 actor_id / staff_id**
- 密碼雜湊在指令碼屬性 `PW_<id>`，不在試算表；**不要在登入框替使用者輸入密碼**，
  測試站資料是正式站的複本（真實同仁），要登入請使用者自己在瀏覽器窗格輸入
- 測試站工具：試算表選單「從正式站同步最新資料」（測試帳號保留、密碼不複製）；
  網頁右下角「測試站」面板可以讓總公司切換成任何在職同仁（`gas/TestIdentity.gs`，正式站無效）
- 本機可以用 Node 模擬 Apps Script 環境跑主要 API（模擬測試腳本放在 scratchpad，不在 repo）；
  `node --check` 可以檢查 .gs 語法
- 不要在 Apps Script 網頁編輯器改程式（會被下次上傳蓋掉）

---

## 三個服務怎麼分工（Railway 版，2026-10-29 起停用、只做退路）

```
GitHub（程式碼）→ Railway（把程式跑起來、給網址）→ Supabase（PostgreSQL 資料庫）
```

- **GitHub 和 Supabase 之間沒有任何連線**，決定權都在 Railway：
  Railway 的 service 設定指定「要跑哪個 branch」，環境變數 `SUPABASE_DB_SCHEMA` 決定「用哪個 schema」
- **正式站**：https://norden-daily-ops-backend-production.up.railway.app（main，`public` schema）
- **測試站**：https://staging-norden-daily-ops-backend-production.up.railway.app（指定的 branch，`staging` schema）
- 兩個網址都含 `production`（Railway 預設環境名），**測試站前面多 `staging-`**，很容易看錯
- 先打 `/api/health` 確認 `db_schema` 是 `public` 還是 `staging`，再動手

**這台機器跑不起來 Railway 版**：2026-10-27 起有裝 Node.js（給 clasp 用），但沒有 `node_modules`、沒有 `.env`。
不要假設可以 `npm run dev`——Railway 版程式碼的第一次執行一定是在 Railway 上，
驗證只能 push 到 branch 之後，用瀏覽器開測試站實測。

---

## 程式架構

### 後端 `src/`

- `server.js` — Express 進入點，掛載所有路由；`app.use('/api', featureGuard)` 在所有路由之前
- `supabaseClient.js` — 一律用 service_role key（繞過 RLS，權限控制在 API 層自己做）；
  讀 `SUPABASE_DB_SCHEMA`（沒設就是 `public`）；啟動時會檢查環境變數格式，**錯誤訊息只印長度不印值**
- `routes/*.js` — 一個功能一支路由，全部是 `supabase.from('表名')`，沒有 `.rpc()`、沒有寫死 schema
- `lib/featureCatalog.js` / `featureState.js` / `featureGuard.js` — 功能開關（見下）

### 前端 `public/`

**純靜態、沒有框架、沒有 build 步驟**，改完檔案 push 就生效。

- `config.js` 的 `API_BASE_URL` 部署時是**空字串**（前後端同網域）。
  ⚠ **不能用 `if (API_BASE)` 判斷有沒有設定**，空字串是 falsy，整段會被跳過（踩過一次）
- 登入狀態就是 `localStorage` 裡的 `staff` 物件（`{ id, name, branch_id, roles: { name, category }, todayShiftCode }`），
  **沒有 token、沒有 session**。`login.js` 依 `roles.name` 和當日班別決定登入後導到哪一頁
- `sidebar.js` **每一頁都會載入**，負責：畫側邊選單、依功能開關過濾選單、攔截被關閉的頁面、
  藏掉指向已關閉功能的連結。要改選單結構就是改這支的 `NAV_SETS`
- `*-home.js`（hq-home、manager-home…）是舊版的首頁 hub，登入流程已經不會導到那裡，但仍保留

### 功能開關（總公司可以整組隱藏功能）

`src/lib/featureCatalog.js` 是**唯一的定義**：一個功能包含哪些網頁、哪些 API 前綴。
資料表 `feature_toggles` 只存「哪個功能被關掉」，表裡沒有的 key 一律視為開啟（fail-open）。

三層都擋：① 選單不顯示 ② 直接打網址導回自評表 ③ API 回 403。
`locked: true` 的項目永遠關不掉（自評表、系統與帳號管理），避免整個系統被鎖死。

**加新功能時，記得在 `featureCatalog.js` 加一筆**，前後端會自動跟上。

### 帳號管理 `routes/accounts.js`

總公司管全部；店經理只能管自己館別的房務、客務，自己的帳號只能改密碼。
權限是後端拿前端送來的 `actor_id` 去資料庫查**真實職務**再判斷。
⚠ 這組 API **沒有登入驗證**，擋得住畫面越權，擋不住偽造 `actor_id`（使用者知道，決定之後再處理）。

### 自評表 `routes/selfEval.js`

時程集中在檔案最上面的 `SCHEDULE`：每月 1 號發布上個月的表、10 號前同仁送出、20 號前主管完成面談。
**日期一律用台灣時間計算**（Railway 跑 UTC，不換算的話台灣時間 1 號早上 8 點前會被當成上個月），
前端也要用伺服器回傳的 `today` 判斷逾期，不要用瀏覽器的 `toISOString()`。

---

## 開發到發布的流程（Google 版，2026-10-29 起）

測試站和正式站是**兩個獨立的 Apps Script 專案**，跑哪一版由 clasp 上傳決定，跟 git branch 無關
（不再需要請使用者切 Railway 的 branch）。GitHub 的 main ＝ 正式站上的版本。

**開發（Claude 自己做到底）**
1. 開新 branch（**不要直接改 main**）；需要最新資料時，請使用者在「路得系統（測試）」按「從正式站同步最新資料」
2. 寫程式：後端 `gas/Xxx.gs`、API 在 `Router.gs` 的 `routes_()` 加一行；前端仍在 `public/`，
   新頁面加進 `build_gas.py` 的 `PAGES`（HTML 最後要有 `sidebar.js`）；新功能在 `Catalog.gs` 加一筆並標 `ported: true`，
   選單在 `sidebar.js` 的 `NAV_SETS`；新欄位／新表改 `gas/Schema.gs`
3. 本機先檢查：`node --check`，需要時用 Node 模擬 Apps Script 跑主要 API
4. 上傳測試站：`python tools/build_gas.py` → `clasp -P clasp-staging.json push -f` →
   **有改 Schema 就請使用者在「路得系統（測試）」按「路得系統 → 檢查資料表結構」** →
   `clasp -P clasp-staging.json redeploy <測試站部署ID> -d "說明"`
5. 用瀏覽器窗格實測。**Claude 不能代輸密碼**：請使用者在窗格裡用總公司帳號登入測試站一次，
   之後由 Claude 用右下角「測試站」面板切換成需要的身分（店經理、房務…）操作驗證，驗完切回總公司；
   有 bug 自己修，回到第 4 步
6. push branch、更新 README，回報「測試站驗證完成」並列出驗證了哪些項目

**發布（使用者說「發布」之後才做）**
7. `python tools/build_gas.py` → `clasp -P clasp-production.json push -f`
   （push 只更新程式碼，同仁用的是「部署」，所以這時候還不會影響任何人）
8. **有改 Schema 就請使用者在「路得系統（正式）」按「檢查資料表結構」**——等於以前的「先跑 SQL 再上程式」
9. `clasp -P clasp-production.json redeploy <正式站部署ID> -d "說明"` → 同仁重新整理就是新版
10. 開 PR 合併進 main，打開正式站網址確認登入頁正常，請使用者登入看一眼

**出問題時**：`clasp -P clasp-production.json redeploy <正式站部署ID> -V <上一個版本號>`，一分鐘內退回上一版
（`clasp -P clasp-production.json versions` 查版本號）。Schema 補的欄位留著不影響舊程式，不用刪。

**注意**
- clasp 出現 `invalid_rapt`＝公司帳號要重新驗證，請使用者自己執行 `clasp login`
- 合併進 main 時 Railway 仍會重新部署，但它只負責把舊網址導向 Google 版；**不要動 `src/server.js` 的導向、不要刪 Railway 的 `REDIRECT_TO_URL`**
- 會改到自評流程的更新，盡量避開每月 1～20 號（同仁填寫、主管面談期間）

## SQL 慣例（Railway 版，停用）

- 檔名 `schema_vNN_說明.sql`，放 repo 根目錄，一份 SQL 要**跑兩次**：
  - 進測試區：最前面加 `set search_path to staging, public;`
  - 進正式區：把那行刪掉再跑一次
- 盡量做到「舊版程式碼看到這張新表也不會壞」，這樣上線順序才能是**先跑 SQL → 再 merge 程式碼**，
  而且萬一要 revert，退掉程式碼就等於完全恢復
- ⚠ 最初建表的 `schema_v2.sql` **不在 repo 裡**，所以沒辦法靠重跑 SQL 檔重建資料庫

## 環境變數（Railway 版，停用）

| 變數 | 正式站 | 測試站 |
|---|---|---|
| `SUPABASE_URL` | 同一個 Supabase 專案 | 同左 |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上 | 同左 |
| `SUPABASE_DB_SCHEMA` | **不設定**（＝`public`） | `staging` |
| `REDIRECT_TO_URL` | Google 版正式站網址（2026-10-29 起） | 不設定 |

---

## 已知限制（使用者知道，刻意還沒處理）

- **API 沒有身分驗證**（Railway 版）：知道 API 的人可以偽造身分呼叫，包含帳號管理和重設密碼。
  Google 版已用登入憑證修掉
- `sidebar.js` 裡原本就有的 `if (API_BASE)` 讓「非台中館隱藏交班表」「房務只有當日小隊長看得到分配」
  「店經理登入提醒 banner」這三個功能從來沒有真正執行過
- 手機窄畫面時，側邊選單的子選單預設展開會蓋住頁面上方
- 缺失照片是 base64 存在資料庫文字欄位，量大會讓資料庫肥大
