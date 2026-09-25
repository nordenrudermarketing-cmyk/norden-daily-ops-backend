-- ============================================================
-- 追加：新增「店副理」職務（店經理的職務代理人）
-- 請到 Supabase SQL Editor 執行（不影響現有資料）
--
-- 要跑兩次：
--   進測試區：最前面加一行  set search_path to staging, public;  再執行
--   進正式區：把那一行刪掉再執行一次
--
-- 職務類別是 management（主管），所以自評表會自動出現主管題目。
-- 舊版程式看到這個新職務不會壞（只是還沒有人被設成這個職務），
-- 所以上線順序是：先跑這份 SQL → 再 merge 程式碼。
-- ============================================================

insert into roles (name, category)
select '店副理', 'management'
where not exists (select 1 from roles where name = '店副理');

-- ------------------------------------------------------------
-- 只有測試區會執行：在台中館建一個測試用的店副理帳號 T-DMGR
-- （正式區跑的時候 current_schema() 是 public，這段會自動跳過）
-- 密碼一開始是空的，第一次登入時輸入的密碼就會變成它的密碼
-- ------------------------------------------------------------
do $$
begin
  if current_schema() <> 'staging' then
    raise notice '正式區：不建立測試帳號';
    return;
  end if;

  insert into staff (name, login_code, branch_id, role_id, is_active)
  select '測試-店副理', 'T-DMGR', b.id, r.id, true
  from roles r, branches b
  where r.name = '店副理' and b.name = '台中館'
    and not exists (select 1 from staff s where s.login_code = 'T-DMGR');
exception when others then
  raise notice '建立 T-DMGR 失敗：%（把錯誤訊息回報給我即可）', sqlerrm;
end $$;

-- 檢查：應該看到「店副理 / management」這一列
select name, category from roles where name = '店副理';
