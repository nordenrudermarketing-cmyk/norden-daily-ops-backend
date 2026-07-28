# 路得行旅 每日營運系統 — 後端 API

目前包含三組核心功能（對應房務打掃 → 客務C班巡房檢查 → 業績獎金試算 這條流程）：

- `POST /api/login` — 同仁用登入代碼登入
- `POST /api/room-cleanings/assign` — 小隊長分配房號給房務同仁
- `GET  /api/room-cleanings/mine` — 房務同仁：今日負責房號清單
- `POST /api/room-cleanings/:id/complete` — 標記房間完成
- `GET  /api/room-cleanings/pending-inspection` — 客務C班：待檢查房號
- `POST /api/room-cleanings/:id/inspect` — 巡房檢查結果（正常 / 回報缺失）
- `GET  /api/bonus/daily` — 當日房務業績獎金試算

## 部署到 Railway（step by step）

1. **建立 Supabase 專案**（如果還沒做）
   - [supabase.com](https://supabase.com) → New Project
   - SQL Editor 貼上 `schema_v2.sql` 全部內容並執行
   - Settings → API，複製 `Project URL` 和 `service_role` key

2. **把這個資料夾放到 GitHub**
   - 在 GitHub 開一個新 repo（例如 `norden-daily-ops-backend`）
   - 把這整個資料夾的內容 push 上去（或用 GitHub 網頁介面直接上傳檔案）

3. **在 Railway 建立服務**
   - Railway 專案 → New → Deploy from GitHub repo → 選剛剛那個 repo
   - Variables 分頁，新增兩個環境變數：
     - `SUPABASE_URL` = 剛剛複製的 Project URL
     - `SUPABASE_SERVICE_ROLE_KEY` = 剛剛複製的 service_role key
   - Railway 會自動偵測 `package.json` 並跑 `npm start`

4. **確認部署成功**
   - 打開 Railway 給的網址（例如 `xxx.up.railway.app`），應該會看到 `{"status":"ok",...}`

## 本機測試（可選）

```bash
npm install
cp .env.example .env   # 填入 Supabase 資訊
npm run dev
```

## 同仁端網頁

`public/` 資料夾裡是三個網頁，跟後端部署在同一個 Railway 服務，不用另外設定網址：

- `index.html` — 登入頁（輸入登入代碼，依職務自動導向對應頁面）
- `checklist.html` — 房務同仁：今日房號打卡
- `inspect.html` — 客務C班：巡房檢查、回報缺失（含拍照）

部署後打開 Railway 給的網址就會直接看到登入頁。

新增：

- `assign.html` — 小隊長：今日房號分配（下拉選單指派每間房給誰，一次儲存）
  - 可從 checklist.html 上方連結進入
  - 對應 API：`GET /api/rooms`、`GET /api/staff/list`、
    `GET /api/room-cleanings/assignments`、`POST /api/room-cleanings/assign-batch`

- `dashboard.html` — 店經理：電腦版營運總覽（今日房況、房務業績獎金總表、未處理缺失、
  本月細清進度）
  - 對應 API：`GET /api/dashboard/summary`
  - 登入時角色若為「店經理」會自動導向這頁

- `deep-clean.html` — 樓主：本月細清排程（設定各樓層樓主、各樓層排第幾週、產生本月
  任務、標記完成）
  - 對應 API：`GET/POST /api/deep-clean/floor-owners`、`GET /api/deep-clean/templates`、
    `GET /api/deep-clean/month`、`POST /api/deep-clean/generate`、
    `POST /api/deep-clean/:id/complete`
  - 可從 checklist.html 上方連結進入
- `shift.html` — 客務A/B/C班：今日班別任務打卡（依 daily/weekday/monthly_date 規則
  自動判斷今天該出現哪些任務）
  - 對應 API：`GET /api/shift-tasks/today`、`POST /api/shift-tasks/:id/complete`
  - 登入時角色為「客務A班」「客務B班」會直接導向這頁；「客務C班」導向 inspect.html，
    但頁面上方有連結可以切換過去

- `handover.html` — 客務：交班表（對應紙本格式的結構化欄位＋可自訂欄位）
  - 「公區、客房設備異常回報」欄位會自動帶入當天所有任務按「回報異常」產生的內容，
    同仁可以再編輯或補充
  - 對應 API：`GET /api/handover/today`、`GET /api/handover/defects-today`、`POST /api/handover`
  - 同一天同一班別重複送出會更新，不會重複建立
- `shift.html` 每個任務旁邊多了「回報異常」按鈕（不管任務有沒有標記完成都能按），
  對應 API：`POST /api/issues/report`——這支是通用的，之後房務/細清任務要加同樣的
  回報按鈕，可以直接呼叫同一支 API

**部署前多一步**：先到 Supabase SQL Editor 執行 `schema_v3_handover.sql`（新增交班表
的資料表），再上傳程式碼。

- `schedule.html` — 店經理：排班表（取代 Excel）
  - 依部門分組顯示同仁，每格是下拉選單選當天班別代碼
  - 自動統計每人休假天數（跟目標天數不符會標紅）、每日客務/房務上班人數（低於門檻標紅）
  - 點日期標題可切換「禁休日」（粉色），跟休假天數目標、最低上班人數都可以每月調整
  - 對應 API：`GET/POST /api/schedule/*`
  - **這是協助計算的工具，不會自動生成班表**——班別代碼要主管自己填，系統只負責統計跟警告
- `templates.html` — 店經理：客務班別任務範本管理（新增/編輯/停用任務項目，不用等改程式碼）
  - 對應 API：`GET/POST/PUT /api/templates/shift-tasks*`
- `offday.html` — 排休日登入會看到的簡單頁面

**登入流程改了**：現在登入時會先查今天的排班表（`staff_schedule`），如果today有排班紀錄，
依實際排的班別代碼導向對應頁面（A/B→shift.html，C→inspect.html，房→checklist.html，
1→offday.html）；如果今天沒有排班紀錄（例如還沒排班、或代碼是中/特/管/PT這種還沒對應頁面的），
才會退回用同仁的固定職務判斷，維持原本行為當備援。

**部署前多一步**：先到 Supabase SQL Editor 執行 `schema_v4_schedule.sql`。

- `issues.html` — 店經理：異常處理（取代「只能在對話裡看」的缺失回報）
  - **處理清單**：所有來源（客房/客務任務/公共空間/細清）的異常，可篩選待處理/已處理，
    有「標記已處理」按鈕
  - **房間重複問題**：依房號統計一段期間內（14/30/90天可切換）的異常次數，3次以上會
    特別標紅，方便看出「同一間房反覆出問題」
  - 對應 API：`GET /api/issues/list`、`POST /api/issues/:id/resolve`、
    `GET /api/issues/room-trends`
  - 可從店經理儀表板上方連結進入

- **系統偵測異常（自動）**：同一間房在30天內累積到3次異常回報（不管有沒有處理過都算），
  系統會自動在 `anomaly_logs` 產生一筆警示，店經理登入儀表板會直接看到紅色提示區塊，
  不用自己去異常處理頁翻。已經有一筆待處理的同類型警示不會重複產生，避免洗版。
  店經理按「確認處理」後，下一次再累積到門檻才會產生新的一筆。
  - 對應 API：`GET /api/issues/anomalies`、`POST /api/issues/anomalies/:id/resolve`
  - 偵測邏輯寫在 `POST /api/room-cleanings/:id/inspect` 裡，目前門檻（3次/30天）是寫死在
    程式碼裡，之後如果想讓店經理自己調整門檻，可以再加設定頁面

- `manager-checklist.html` — 店經理：每日巡館清單（對應原始文件的八項工作：每日巡館、
  住房率確認、人力配置確認、客訴與旅客反饋、設備維修案件、房務及櫃檯品質抽查、
  同仁教育與溝通、異常事件回報）
  - 「住房率確認」「人力配置確認」會自動帶入系統既有數字（今日房務完成數、今日排班
    人數），不用手動再查一次
  - 對應 API：`GET /api/manager-checklist/today`、`POST /api/manager-checklist/:id/complete`
  - 可從店經理儀表板上方連結進入

**部署前多一步**：先到 Supabase SQL Editor 執行 `schema_v5_manager_checklist.sql`。

## 已知限制 / 下一步

- **缺失照片**是用瀏覽器直接轉成 base64 存進資料庫的文字欄位，量大或照片解析度高時
  資料庫會變得肥大。之後建議改成上傳到 Supabase Storage，資料庫只存網址連結。
- 主管端電腦儀表板還沒做（今日獎金總表、缺失趨勢、樓主細清進度）。
- 目前任何「房務」類角色都能看到房號分配跟細清排程連結，還沒有依「當天是否為
  小隊長／樓主」做權限限制（你確認過小隊長不用權限控管，先維持人工自律）。
- 排班表的「特」「中」「管」「PT1」「PT2」目前沒有對應的任務頁面，登入時會退回用固定
  職務判斷；如果之後想幫這些班別也做專屬頁面，可以再討論。
- 教育訓練系統（新人學習地圖、教練制度、四階段考核）還沒開始建，設計方向已在
  對話中討論過，包含 learning_paths / learning_units / staff_learning_progress /
  coach_assignments / assessment_stages / performance_reviews 這幾張表。
