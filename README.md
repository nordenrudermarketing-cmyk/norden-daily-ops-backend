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

## 尚未包含（下一步會做）

- 同仁端網頁介面（打卡頁面、巡房檢查頁面）— 目前只有 API
- 主管端電腦儀表板
- 照片上傳（目前 API 接受 `defect_photo_url` 文字欄位，實際上傳邏輯建議直接在前端串 Supabase Storage）
