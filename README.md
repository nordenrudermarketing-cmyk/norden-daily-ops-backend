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

- `learning-map.html` — 新人教育訓練（依「房務員工訓練紀錄表」「新人學習確認表」兩份
  實際文件內容建置，房務57項、客務48項）
  - 選職務類別（房務/客務）→ 選同仁 → 看到完整學習清單，依分類（房務）或主題+分類
    （客務）分組
  - 每一項可以填培訓員、教學日期、驗收結果（合格/不合格），對應原本 Excel 的欄位
  - 上方有整體進度（已合格幾項/總項數）
  - 房務類別多一塊「整房實作考核」，可以新增考核紀錄（房間組成、限時、分數、合格與否）
  - 對應 API：`GET/POST /api/training/progress`、`GET/POST /api/training/exams`
  - 目前沒有限制誰能填寫/編輯（跟你之前說小隊長不用權限控管一致），任何登入的同仁都
    可以幫任何人填寫進度，之後如果想限制只有教練/主管能編輯可以再討論

**部署前要跑兩份 SQL，依序執行**：
1. `schema_v6_training.sql`（建表 + 建立兩條學習地圖）
2. `schema_v6_training_seed.sql`（把57+48項訓練內容塞進去，要在第一份執行成功後才能跑）

- **四階段考核**（認識→操作→獨立→穩定）已經整合進 `learning-map.html` 同一頁：
  - 選好同仁後，下方會出現四階段的橫向進度條，點哪個階段就編輯哪個階段
  - 每個階段都有十個面向評分（工作態度、專業能力、工作品質、工作效率、溝通能力、
    團隊合作、主動性、責任感、問題處理、品牌認同），對應原始文件的考核內容
  - 填評核者、備註、通過/尚未通過，儲存後階段條會變色標示已通過
  - 對應 API：`GET/POST /api/assessment/stages`
  - 四個階段目前**沒有強制循序**（可以直接跳去填「穩定」而不用先過「認識」），
    如果你希望系統強制照順序才能往下一階段，跟我說一聲再加邏輯

**部署前多一步**：先到 Supabase SQL Editor 執行 `schema_v7_assessment.sql`。

## 職務簡化

`房務小隊長`／`房務樓主` 這兩個職務已經拿掉，統一併回 `房務人員`。原因：
- 小隊長本來就是每天輪值，職務欄位標記反而不準確
- 樓主的認養狀況已經有 `floor_owners` 表在追蹤（誰在哪個月負責哪個樓層）
- 房號分配（`assign.html`）、細清排程（`deep-clean.html`）本來就沒有限制只有小隊長／樓主能用，
  任何房務人員登入都看得到那兩個連結，拿掉職務不影響任何現有功能

## 總公司模組

- `hq-dashboard.html` — 總公司：跨館總覽 + 任務分派
  - 每個館別一張卡片：今日房務完成度、未處理異常（含最久幾天沒處理）、未處理缺失、
    店經理巡館完成度、待處理總公司任務數
  - 積壓超過7天沒處理的異常或缺失，卡片會整個標紅提醒
  - **點卡片可以展開實際內容**：系統偵測異常的完整描述、未處理缺失清單（含房號/來源、
    回報人、時間），也能直接在這裡標記已處理，不用切到各館分別查
  - 下方可以直接交辦新任務給指定館別（標題、說明、期限、交辦人）
  - 對應 API：`GET /api/hq/overview`、`GET/POST /api/hq/tasks`、
    `GET /api/issues/anomalies`、`GET /api/issues/list`（沿用既有的異常處理 API，
    差別只是總公司可以指定任何館別的 branch_id 查）
  - 登入時角色若為「總公司」會自動導向這頁
- 店經理儀表板新增「📋 總公司交辦事項」區塊，會顯示自己館別待處理的任務，可以填回報內容
  後標記完成
  - 對應 API：`GET /api/hq/tasks/branch`、`POST /api/hq/tasks/:id/complete`

**部署前要跑 SQL**：執行 `schema_v8_hq.sql`。**這份會做資料異動**（把房務小隊長／樓主的同仁
改成房務人員、刪除這兩個職務），建議先在 Supabase 確認目前有沒有同仁掛在這兩個職務下，
執行後這些同仁的職務欄位會自動變成「房務人員」，不會影響他們的登入代碼或其他資料。

## 台東1館 + 分館獎金規則

- 新增台東1館館別，房號63間（A-E責任區，房號含2/3樓一般房與R樓/RF頂樓房型）
- `rooms.zone` 新欄位：台東1館用來記錄A-E責任區，台中館沒有這層留空即可
- **獎金規則改成每個館可以不一樣**（`bonus_settings` 新增 `rate_type`、`tier1_max`、
  `tier1_rate`、`tier2_rate`、`require_full_completion` 欄位）：
  - 台中館：`linear`，淨間數 × 固定單價（原本邏輯不變）
  - 台東1館：`tiered`，前12間$10/間、第13間起$20/間，且 `require_full_completion=true`
    ——當天沒有在期限前把被分配的房間全部完成，整天不算獎金
  - 計算邏輯統一寫在 `src/lib/bonusCalc.js`，`bonus.js` 跟 `dashboard.js` 都呼叫同一支，
    之後台東2館如果規則又不同，只要調整 `bonus_settings` 的資料，不用改程式碼
  - 儀表板的獎金表格，如果當天因為「未全部完成」被取消資格，會顯示提示文字

**部署前要跑 SQL**：執行 `schema_v9_tt1.sql`。

**還沒做的部分（照你選的優先順序，下一步繼續）**：房號分區保養排程（A-E區週循環）、
公區保養月曆（日常+月清+雙月清）、每日房務日誌的小隊編組結構。

## 這次修正（依台東1館店長確認的實際規則）

- **獎金門檻改成固定數字，不是「全部完成」**：15:00前完成間數要達到門檻（台東1館是12間）
  才有獎金，不是「把當天分配的房間全部做完」——如果分配15間、15:00前完成13間，一樣有獎金
  （淨間數=13扣缺失），只要13≥12門檻就過關
  - 對應欄位：`bonus_settings.min_rooms_for_bonus`
- **PT（兼職）同仁不計入房務打掃獎金**：`staff` 表新增 `is_part_time` 欄位，獎金計算的
  同仁清單會排除這些人
- **排班表新增「房務小隊長」列**：經理排班時可以直接在排班表指定每天的房務小隊長，
  跟班別代碼分開存（`daily_team_leads` 表），對應 `GET/POST /api/schedule/*` 一併回傳/儲存
- **B班在需要支援巡房時，`shift.html` 也會顯示「前往巡房檢查」連結**（原本只有C班看得到）

**部署前要跑 SQL**：執行 `schema_v10_fixes.sql`。

## 這次修正（獎金確認關卡 + 動態班別任務）

- **獎金只算客務已經巡房確認過的房間**：房務同仁標記「完成」後，如果客務還沒去巡房
  檢查（`checked_by` 還是空的），這間房不會算進獎金總表，也不會出現在店經理儀表板的
  獎金數字裡，等客務確認過（不管正常還是回報缺失）才會被算進去
- **班別任務清單改成「排班型態切換」，不是自動合併**：系統查當天有沒有排C班，有排就用
  「ABC」版本的任務清單，沒排（例如AABB）就用「AABB」版本——這兩套內容是台東1館提供的
  真實日誌逐條建進去的，AABB版本裡C班的工作已經按時段拆分揉進A、B班（有些用詞跟時間點
  也不一樣，不是系統自動硬塞），如果某個班別沒有對應的AABB版本會自動退回ABC版本
  （台中館目前只有ABC版本，不受影響）
- **修正房號分配的資料覆蓋 bug**：小隊長追加分配新房號時，已經完成的房間不會再被
  洗回「待完成」

**部署前要跑兩份 SQL，依序執行**：`schema_v11_shift_pattern.sql`（先加欄位）→
`schema_v11_seed.sql`（再塞入台東1館ABC/AABB兩套完整任務內容，共136項）。

## 登入備援機制調整

客務（A/B/C班）現在**一定要有排班表紀錄**才能看到今日任務——沒有排班紀錄的客務同仁登入
會看到 `unscheduled.html` 提醒頁（「今天還沒有排班紀錄，請聯繫店經理確認本月排班表」），
不會再退回用固定職務猜測顯示哪一版任務清單。

房務、店經理、總公司這幾個角色**維持原本的固定職務備援**，不受影響：
- 房務的房號是小隊長另外分配的，跟排班表是兩件事
- 店經理、總公司本來就不是靠排班表運作的角色

## 客務職務簡化

`客務A班`／`客務B班`／`客務C班` 這三個職務拿掉了，統一併回 `客務人員`。理由跟房務
小隊長／樓主一樣：沒有人是固定哪一班，每天是誰、上哪一班，是排班表決定的，職務欄位
不該綁死。系統原本判斷「今天顯示哪一版任務清單」，本來就是看排班表的 `shift_code`
（A/B/C），跟固定職務名稱無關，所以拿掉這三個職務不影響任何現有功能，只是讓資料更準確。

**部署前要跑 SQL**：執行 `schema_v12_frontdesk_role.sql`（會把掛在A/B/C班職務下的同仁
自動改成客務人員，再刪掉這三個職務，不影響其他資料）。

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
