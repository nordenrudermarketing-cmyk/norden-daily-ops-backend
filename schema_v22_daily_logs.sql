-- ============================================================
-- 追加：① 掃單記錄 ② 評論回報改成每日一筆 ③ NO SHOW改成每日一筆
--      ④ 客務個人清潔配額
-- 請到 Supabase SQL Editor 依序執行：先這份，再執行 schema_v22_seed.sql
-- ============================================================

-- ① 掃單記錄（每日一筆）
create table order_sweep_logs (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           uuid references branches(id),
  work_date           date not null,
  checkin_count       int,     -- 住房訂單數
  checkin_anomaly     text,    -- 有無異常
  checkin_order_no    text,    -- 訂單編號
  new_order_count     int,     -- 昨日新進訂單數
  new_order_missing   text,    -- 有無遺漏
  new_order_no        text,    -- 訂單編號
  updated_by          uuid references staff(id),
  updated_at          timestamptz default now(),
  unique (branch_id, work_date)
);

-- 掃單相關的案例分享／互相提醒（不綁日期，像留言板）
create table order_sweep_notes (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id),
  order_no     text,
  content      text not null,
  staff_id     uuid references staff(id),
  created_at   timestamptz default now()
);

-- ② 評論回報改成每日一筆（四平台各自填內容，不是打勾）
create table review_daily_logs (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id),
  work_date       date not null,
  bk_note         text,
  ag_note         text,
  ctrip_note      text,
  google_note     text,
  special_report  text,   -- 故障/客訴類特殊回報
  checked_by      uuid references staff(id),
  checked_at      timestamptz,
  unique (branch_id, work_date)
);

-- ③ NO SHOW改成每日一筆（沒發生就寫「無」）
create table no_show_daily_logs (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id),
  work_date       date not null,
  order_info      text,   -- 訂單
  charged_note    text,   -- 有收費
  uncharged_note  text,   -- 沒收費
  note            text,
  reported_by     uuid references staff(id),
  reported_at     timestamptz,
  unique (branch_id, work_date)
);

-- ④ 客務個人清潔配額（每人每月至少4項，挑不同類別，拍照回報）
create table staff_cleaning_templates (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id),
  category     text not null,   -- A / B / C / D
  item_name    text not null,
  sort_order   int default 0
);

create table staff_cleaning_completions (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid references staff_cleaning_templates(id),
  staff_id       uuid references staff(id),
  month          date not null,   -- 該月第一天
  completed_date date,
  photo_url      text,
  unique (template_id, staff_id, month)
);
