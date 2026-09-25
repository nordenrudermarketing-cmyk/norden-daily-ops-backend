# 給 Claude 的專案說明

路得行旅（Norden）每日營運系統。飯店內部用，同仁用手機或電腦打開網頁登入使用。
**請一律用繁體中文回覆、寫註解、寫 commit 訊息**，使用者沒有工程背景。

README.md 是這個專案的**變更紀錄兼說明書**，每加一個功能就往下追加一節，內容比這份詳細。
改完功能記得也更新 README。

---

## 三個服務怎麼分工

```
GitHub（程式碼）→ Railway（把程式跑起來、給網址）→ Supabase（PostgreSQL 資料庫）
```

- **GitHub 和 Supabase 之間沒有任何連線**，決定權都在 Railway：
  Railway 的 service 設定指定「要跑哪個 branch」，環境變數 `SUPABASE_DB_SCHEMA` 決定「用哪個 schema」
- **正式站**：https://norden-daily-ops-backend-production.up.railway.app（main，`public` schema）
- **測試站**：https://staging-norden-daily-ops-backend-production.up.railway.app（指定的 branch，`staging` schema）
- 兩個網址都含 `production`（Railway 預設環境名），**測試站前面多 `staging-`**，很容易看錯
- 先打 `/api/health` 確認 `db_schema` 是 `public` 還是 `staging`，再動手

**這台機器跑不起來這個專案**：沒有 Node.js、沒有 `node_modules`、沒有 `.env`。
不要假設可以 `npm run dev` 或跑測試——程式碼的第一次執行一定是在 Railway 上，
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

### 職務等級 `lib/roleLevel.js`

`總公司 → hq`、`店經理 → manager`、`店副理 → deputy`（店經理的職務代理人）、其他 → `staff`。
需要權限的 API 一律要前端帶 `?actor_id=`，後端用 `loadActor()` 去資料庫查**真實職務**再判斷，
不要相信前端送來的職務。前端判斷主管時要記得店經理、店副理兩個都要算
（`['店經理', '店副理'].includes(staff.roles?.name)`）。

### 帳號管理 `routes/accounts.js`

總公司管全部；店經理管自己館別的房務、客務、店副理；店副理只管自己館別的房務、客務。
自己的帳號只能改密碼。
⚠ 這組 API **沒有登入驗證**，擋得住畫面越權，擋不住偽造 `actor_id`（使用者知道，決定之後再處理）。

### 自評表 `routes/selfEval.js`

時程集中在檔案最上面的 `SCHEDULE`：每月 1 號發布上個月的表、10 號前同仁送出、20 號前主管完成面談。
**日期一律用台灣時間計算**（`lib/taiwanTime.js`；Railway 跑 UTC，不換算的話台灣時間 1 號早上 8 點前會被當成上個月），
前端也要用伺服器回傳的 `today` 判斷逾期，不要用瀏覽器的 `toISOString()`。

面談對象由 `canInterview()` 決定：店經理面談本館副理、房務、客務；店副理只面談本館房務、客務；
都不能面談自己。`branch-overview`、`manager-review` 要帶 `actor_id`。

---

## 加新功能的步驟

1. 開新 branch（**不要直接改 main**）
2. 後端加 `src/routes/xxx.js`，在 `server.js` 掛載
3. 前端加 `public/xxx.html` + `xxx.js`；HTML 最後要有 `<script src="sidebar.js"></script>`
4. 在 `featureCatalog.js` 加一筆（頁面、API 前綴），需要的話在 `sidebar.js` 的 `NAV_SETS` 加選單項目
5. 要動資料庫就加 `schema_vNN_說明.sql`（見下）
6. push → 請使用者把 Railway 測試站的 Branch 指到這個 branch → 用瀏覽器實測
7. 更新 README
8. **等使用者說「發布」才 merge 到 main**

## SQL 慣例

- 檔名 `schema_vNN_說明.sql`，放 repo 根目錄，一份 SQL 要**跑兩次**：
  - 進測試區：最前面加 `set search_path to staging, public;`
  - 進正式區：把那行刪掉再跑一次
- 盡量做到「舊版程式碼看到這張新表也不會壞」，這樣上線順序才能是**先跑 SQL → 再 merge 程式碼**，
  而且萬一要 revert，退掉程式碼就等於完全恢復
- ⚠ 最初建表的 `schema_v2.sql` **不在 repo 裡**，所以沒辦法靠重跑 SQL 檔重建資料庫

## 環境變數（Railway）

| 變數 | 正式站 | 測試站 |
|---|---|---|
| `SUPABASE_URL` | 同一個 Supabase 專案 | 同左 |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上 | 同左 |
| `SUPABASE_DB_SCHEMA` | **不設定**（＝`public`） | `staging` |

---

## 已知限制（使用者知道，刻意還沒處理）

- **API 沒有身分驗證**：知道 API 的人可以偽造身分呼叫，包含帳號管理和重設密碼
- **店經理自己的自評沒有人可以面談**：店經理不能面談自己，總公司也還沒有面談畫面
- `sidebar.js` 裡原本就有的 `if (API_BASE)` 讓「非台中館隱藏交班表」「房務只有當日小隊長看得到分配」
  「店經理登入提醒 banner」這三個功能從來沒有真正執行過
- 手機窄畫面時，側邊選單的子選單預設展開會蓋住頁面上方
- 缺失照片是 base64 存在資料庫文字欄位，量大會讓資料庫肥大
