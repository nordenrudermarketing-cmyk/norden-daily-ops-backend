-- ============================================================
-- 建立測試用的 staging schema（第 1 份，共 2 份）
--
-- 在同一個 Supabase 專案裡，複製一份「只有結構、沒有資料」的資料表，
-- 讓測試用的 Railway service 有地方可以隨便寫，不會碰到正式資料。
--
-- 這份 SQL 只會「新增」staging 這個 schema，
-- 完全不會動到 public（正式資料）裡的任何一張表或任何一筆資料。
--
-- 可以重複執行：已經建好的表和外鍵會自動跳過。
--
-- 執行完之後：
--   ① 接著執行 staging_02_seed.sql（塞範本資料和假同仁）
--   ② 到 Supabase → Settings → API → Exposed schemas 把 staging 加進去
-- ============================================================

create schema if not exists staging;

do $$
declare
  r   record;
  ddl text;
  n_tables int := 0;
  n_fks    int := 0;
begin
  -- ------------------------------------------------------------
  -- ① 複製每一張表的結構
  --    including all＝欄位、型別、預設值（含 gen_random_uuid()）、not null、
  --    主鍵、unique、check、索引，全部照抄
  -- ------------------------------------------------------------
  for r in
    select tablename from pg_tables where schemaname = 'public' order by tablename
  loop
    execute format('create table if not exists staging.%I (like public.%I including all)',
                   r.tablename, r.tablename);
    n_tables := n_tables + 1;
  end loop;

  -- ------------------------------------------------------------
  -- ② 外鍵：including all 不會複製外鍵，要自己重建一份（指向 staging 自己的表）
  --
  --    這步不能省。Supabase 的關聯查詢（程式裡的 roles(name, category)、
  --    rooms!inner(branch_id) 這種寫法）就是靠外鍵才知道兩張表怎麼接，
  --    少了外鍵這些查詢會直接回錯誤。
  -- ------------------------------------------------------------
  for r in
    select
      rel.relname  as table_name,
      con.conname  as con_name,
      frel.relname as ref_table,
      (select string_agg(quote_ident(a.attname), ', ' order by u.ord)
         from unnest(con.conkey) with ordinality u(attnum, ord)
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = u.attnum) as cols,
      (select string_agg(quote_ident(a.attname), ', ' order by u.ord)
         from unnest(con.confkey) with ordinality u(attnum, ord)
         join pg_attribute a on a.attrelid = con.confrelid and a.attnum = u.attnum) as ref_cols,
      case con.confdeltype
        when 'c' then ' on delete cascade'
        when 'n' then ' on delete set null'
        when 'd' then ' on delete set default'
        when 'r' then ' on delete restrict'
        else ''
      end as on_delete
    from pg_constraint con
    join pg_class     rel  on rel.oid  = con.conrelid
    join pg_class     frel on frel.oid = con.confrelid
    join pg_namespace ns   on ns.oid   = rel.relnamespace
    join pg_namespace fns  on fns.oid  = frel.relnamespace
    where con.contype = 'f'
      and ns.nspname  = 'public'
      and fns.nspname = 'public'
  loop
    ddl := format(
      'alter table staging.%I add constraint %I foreign key (%s) references staging.%I (%s)%s',
      r.table_name, r.con_name, r.cols, r.ref_table, r.ref_cols, r.on_delete
    );
    begin
      execute ddl;
      n_fks := n_fks + 1;
    exception
      when duplicate_object then null;               -- 重跑時已經有了，跳過
      when others then raise notice '外鍵建立失敗 %.% ：%', r.table_name, r.con_name, sqlerrm;
    end;
  end loop;

  raise notice '完成：複製 % 張表、建立 % 條外鍵', n_tables, n_fks;
end $$;

-- ------------------------------------------------------------
-- ③ 權限：service_role 就是後端 API 在用的身分，沒有這段會全部讀不到
-- ------------------------------------------------------------
grant usage on schema staging to postgres, anon, authenticated, service_role;
grant all on all tables    in schema staging to postgres, service_role;
grant all on all sequences in schema staging to postgres, service_role;

alter default privileges in schema staging grant all on tables    to postgres, service_role;
alter default privileges in schema staging grant all on sequences to postgres, service_role;

-- ------------------------------------------------------------
-- 檢查：跑完應該會看到 staging 的表數量跟 public 一樣
-- ------------------------------------------------------------
select
  (select count(*) from pg_tables where schemaname = 'public')  as public_表數,
  (select count(*) from pg_tables where schemaname = 'staging') as staging_表數;

-- ------------------------------------------------------------
-- 之後每次有新的 schema_v*.sql 要上：
--   public 跑完之後，把同一份 SQL 的 create table 再對 staging 跑一次，
--   或直接重跑這份 staging_01_setup.sql（它會自動補上新表，舊的跳過）。
--   ⚠ 兩邊結構不同步的話，測試結果就不準了。
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 想整組砍掉重來的話（只會刪 staging，不會碰 public）：
--
--   drop schema staging cascade;
-- ------------------------------------------------------------
