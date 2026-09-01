-- ============================================================
-- 測試資料（第 2 份，共 2 份）— 請先執行 staging_01_setup.sql
--
-- 做兩件事：
--   ① 從 public 複製「範本／設定」類的資料（館別、職務、房號、各種題目範本）
--      —— 這些是公司內容，不是個人資料，複製過來測試環境才有東西可以看
--   ② 建立 4 個假帳號（總公司／店經理／房務／客務）
--
-- ⚠ 絕對不會複製的：真實同仁名單、密碼、自評表作答、客訴、缺失、打卡紀錄。
--
-- 一樣完全不會動到 public 的任何資料，可以重複執行。
-- ============================================================

-- ------------------------------------------------------------
-- ① 複製範本／設定類資料
--    順序有意義：被別人參照的表要先複製（branches → rooms）
--    某張表如果複製失敗（例如它其實有連到 staff），會跳過並印出訊息，
--    不會讓整份 SQL 中斷
-- ------------------------------------------------------------
do $$
declare
  t   text;
  cnt bigint;
  ref_tables text[] := array[
    'branches', 'roles', 'rooms',
    'bonus_settings', 'schedule_settings',
    'shift_task_templates', 'deep_clean_task_templates',
    'manager_task_templates', 'manager_worksheet_templates',
    'public_area_maintenance_templates', 'room_maintenance_templates',
    'staff_cleaning_templates',
    'self_eval_templates',
    'learning_paths', 'learning_units',
    'written_exam_questions'
  ];
begin
  foreach t in array ref_tables loop
    begin
      execute format('insert into staging.%I select * from public.%I on conflict do nothing', t, t);
      get diagnostics cnt = row_count;
      raise notice '複製 % ：% 筆', t, cnt;
    exception when others then
      raise notice '略過 % ：%', t, sqlerrm;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------
-- ② 建立假帳號
--    密碼欄位留空 → 第一次登入時輸入什麼，那組就會變成密碼
--    （跟正式環境「第一次登入設定密碼」的行為一樣）
--
--    登入代碼：T-HQ / T-MGR / T-HK / T-FD
-- ------------------------------------------------------------
do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('測試-總公司', 'T-HQ',  '總公司',   '總公司'),
      ('測試-店經理', 'T-MGR', '店經理',   '台中館'),
      ('測試-房務',   'T-HK',  '房務人員', '台中館'),
      ('測試-客務',   'T-FD',  '客務人員', '台中館')
    ) as t(name, login_code, role_name, branch_name)
  loop
    begin
      execute format(
        'insert into staging.staff (name, login_code, branch_id, role_id, is_active)
         select %L, %L, b.id, r.id, true
         from staging.roles r, staging.branches b
         where r.name = %L and b.name = %L
           and not exists (select 1 from staging.staff s where s.login_code = %L)',
        v.name, v.login_code, v.role_name, v.branch_name, v.login_code
      );
    exception when others then
      raise notice '建立 % 失敗：%（可能是 staff 表有其他必填欄位，把錯誤訊息回報給我即可）',
                   v.login_code, sqlerrm;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------
-- ③ 給測試客務排今天的 A 班，這樣登入才會進「今日班別任務」
--    （沒有排班的話會被導到 unscheduled.html，那也是正確行為）
--    失敗不影響其他東西，可以忽略
-- ------------------------------------------------------------
do $$
begin
  insert into staging.staff_schedule (staff_id, work_date, shift_code)
  select s.id, current_date, 'A'
  from staging.staff s
  where s.login_code = 'T-FD'
    and not exists (
      select 1 from staging.staff_schedule x
      where x.staff_id = s.id and x.work_date = current_date
    );
exception when others then
  raise notice '排班沒建成功（可忽略）：%', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 檢查：應該看到 4 筆測試帳號
-- ------------------------------------------------------------
select s.login_code, s.name, r.name as 職務, b.name as 館別,
       case when s.password_hash is null then '尚未設定（第一次登入時設定）' else '已設定' end as 密碼
from staging.staff s
left join staging.roles    r on r.id = s.role_id
left join staging.branches b on b.id = s.branch_id
order by s.login_code;
