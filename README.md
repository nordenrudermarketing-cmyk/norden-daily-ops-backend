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

## 已知限制 / 下一步

- **缺失照片**是用瀏覽器直接轉成 base64 存進資料庫的文字欄位，量大或照片解析度高時
  資料庫會變得肥大。之後建議改成上傳到 Supabase Storage，資料庫只存網址連結。
- 主管端電腦儀表板還沒做（今日獎金總表、缺失趨勢、樓主細清進度）。
- 目前任何「房務」類角色都能看到房號分配連結，還沒有依「當天是否為小隊長」
  （`daily_shift_assignments.is_team_lead`）做權限限制，先靠人工自律使用。
