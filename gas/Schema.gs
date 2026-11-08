// ============================================================
// 資料表結構（取代原本的 schema_vNN.sql）
//
// 每張表＝試算表裡的一個分頁，第一列是欄位名稱，程式依「欄位名稱」找資料，
// 所以欄位順序被調換也沒關係，但欄位名稱不能改。
//
// 型別只影響「讀出來之後」的樣子：試算表裡一律存成純文字（避免 0012 被變成 12）。
//   text   文字（空白讀出來是 null）
//   bool   true / false
//   number 數字
//
// 要加新欄位：在這裡加，然後在試算表選單按「路得系統 → 檢查資料表結構」，會自動補在最後面。
// 不會刪除任何既有欄位或資料。
//
// cache: true 的表會暫存在 Google 快取 10 分鐘，讀取比較快（見 Db.gs）。只給很少改、每次都要讀的表用。
//
// manual: true 的表是「人工維護」的設定類資料（館別、職務、自評題目），
// 分頁標籤會標成藍色，可以直接在試算表上修改；其餘由系統寫入，請不要手動改。
//
// ⚠ 密碼不在這裡：密碼雜湊存在「指令碼屬性」（只有系統擁有者看得到），見 Auth.gs。
// ============================================================

const SCHEMA = {
  // 部門（畫面上叫「部門」，2026-10 以前叫「館別」，表名沿用 branches）。is_active 空白＝啟用中
  branches: {
    manual: true,
    cache: true,
    columns: { id: 'text', name: 'text', code: 'text', is_active: 'bool' },
  },
  // 職務：只決定自評題目。template_category＝要加哪一類專屬題目（見 Org.gs 的 QUESTION_CATEGORIES）
  roles: {
    manual: true,
    cache: true,
    columns: { id: 'text', name: 'text', category: 'text', template_category: 'text', is_active: 'bool' },
  },
  // account_level：帳號層級，決定權限（field 現場人員／manager 主管／hq_admin 總公司行政／office 總辦公室，見 Levels.gs）
  // verify_email：收登入驗證碼的 Email（選填、限主管以上，空白＝只用密碼，見 Auth.gs）
  staff: {
    cache: true,
    columns: {
      id: 'text', name: 'text', branch_id: 'text', role_id: 'text', login_code: 'text',
      is_active: 'bool', is_part_time: 'bool', learning_map_enabled: 'bool', account_level: 'text',
      verify_email: 'text',
    },
  },
  self_eval_templates: {
    manual: true,
    cache: true,
    columns: {
      id: 'text', category: 'text', question_zh: 'text', question_id: 'text',
      sort_order: 'number', is_active: 'bool',
    },
  },
  // reviewed_by：完成面談的主管；last_edited_by：最後存面談草稿的主管（2026-10 管轄功能加入）
  self_eval_submissions: {
    columns: {
      id: 'text', staff_id: 'text', branch_id: 'text', eval_month: 'text', status: 'text',
      due_date: 'text', submitted_at: 'text', manager_interview_notes: 'text', interview_date: 'text',
      manager_signed_at: 'text', created_at: 'text', updated_at: 'text',
      reviewed_by: 'text', last_edited_by: 'text',
    },
  },
  // 管轄：哪位主管負責哪位同仁（一位同仁可以有多位主管），只有總公司能設定，見 Supervision.gs
  supervisions: {
    cache: true,
    columns: { id: 'text', supervisor_id: 'text', staff_id: 'text', created_at: 'text', created_by: 'text' },
  },
  // 管轄部門：哪位主管管哪個部門（多對多）。目前只存設定、不影響權限，給之後的新功能用，見 Supervision.gs
  branch_supervisions: {
    cache: true,
    columns: { id: 'text', supervisor_id: 'text', branch_id: 'text', created_at: 'text', created_by: 'text' },
  },
  // 例行任務（見 Routine.gs）。表名刻意不用舊系統的 routine_tasks，避免從 Supabase 備份匯入時被舊資料蓋掉
  //   period：week／month／year；branch_ids：逗號分隔，空白＝所有部門；steps：每行「日｜要做的事」（月任務）
  routine_items: {
    cache: true,
    columns: {
      id: 'text', audience: 'text', period: 'text', category: 'text', title: 'text', description: 'text',
      report_hint: 'text', branch_ids: 'text', times: 'number', due_weekday: 'number', start_day: 'number',
      due_day: 'number', steps: 'text', remind_month: 'number', due_hint: 'text', sort_order: 'number',
      is_active: 'bool', created_at: 'text', updated_at: 'text', updated_by: 'text',
    },
  },
  // 例行任務的回報：一次回報一列。kind：done 完成／missed 未能完成；period_key：週＝那週週一、月＝YYYY-MM、年＝YYYY
  routine_reports: {
    columns: {
      id: 'text', item_id: 'text', branch_id: 'text', period_key: 'text', kind: 'text',
      note: 'text', late_reason: 'text', staff_id: 'text', created_at: 'text',
    },
  },
  self_eval_answers: {
    columns: {
      id: 'text', submission_id: 'text', template_id: 'text', staff_answer: 'text',
      staff_note: 'text', manager_answer: 'text', manager_note: 'text',
    },
  },
  feature_toggles: {
    cache: true,
    columns: { feature_key: 'text', enabled: 'bool', updated_at: 'text', updated_by: 'text' },
  },
  staff_schedule: {
    columns: { id: 'text', staff_id: 'text', branch_id: 'text', work_date: 'text', shift_code: 'text' },
  },
  daily_team_leads: {
    columns: { id: 'text', branch_id: 'text', work_date: 'text', staff_id: 'text' },
  },
};
