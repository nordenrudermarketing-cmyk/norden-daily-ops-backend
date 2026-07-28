-- ============================================================
-- 追加：客務班別交班表
-- 請到 Supabase SQL Editor 執行這份（不影響現有的表）
-- ============================================================

create table shift_handover_reports (
  id                      uuid primary key default gen_random_uuid(),
  branch_id               uuid references branches(id),
  work_date               date not null,
  shift_code              text not null,     -- 交班的那一班：A / B / C

  handover_staff          text,              -- 交班人員（可多人，用文字存，例如「婕瑜、榆芳」）
  next_shift_staff        text,              -- 接班確認人員

  checkin_count           int,               -- 本日入住
  checkout_expected_count int,               -- 明日預退
  late_checkin_rooms      text,              -- 晚入住房號

  billing_anomaly_note    text,              -- 異常帳務說明
  card_handover_check     text,              -- 總卡點交，例如「8/8」
  pending_items           text,              -- 交付之處理事項

  facility_issue_note     text,              -- 公區、客房設備異常回報（可由任務回報自動帶入，同仁再編輯）
  complaint_note          text,              -- 客訴/突發狀況

  cash_total              numeric,           -- 現金總額
  receipt_total           numeric,           -- 憑證總額

  extra_fields            jsonb default '{}',-- 自訂欄位（之後想加項目直接存這裡，不用改資料庫結構）

  submitted_by            uuid references staff(id),
  submitted_at            timestamptz default now(),

  unique (branch_id, work_date, shift_code)
);

create index idx_handover_branch_date on shift_handover_reports(branch_id, work_date);
