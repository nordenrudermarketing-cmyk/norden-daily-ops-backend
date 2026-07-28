-- ============================================================
-- 追加：四階段考核（認識→操作→獨立→穩定）
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
-- ============================================================

create table assessment_stage_evaluations (
  id                uuid primary key default gen_random_uuid(),
  staff_id          uuid references staff(id) on delete cascade,
  stage             text not null,   -- 認識 / 操作 / 獨立 / 穩定
  evaluated_by      text,
  evaluated_at      timestamptz,
  category_ratings  jsonb default '{}',  -- 十個面向的評分：工作態度/專業能力/工作品質/工作效率/溝通能力/團隊合作/主動性/責任感/問題處理/品牌認同
  result            text,            -- pass / not_yet
  notes             text,
  unique (staff_id, stage)
);
