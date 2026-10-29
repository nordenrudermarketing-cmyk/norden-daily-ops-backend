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
  branches: {
    manual: true,
    cache: true,
    columns: { id: 'text', name: 'text', code: 'text' },
  },
  roles: {
    manual: true,
    cache: true,
    columns: { id: 'text', name: 'text', category: 'text' },
  },
  staff: {
    cache: true,
    columns: {
      id: 'text', name: 'text', branch_id: 'text', role_id: 'text', login_code: 'text',
      is_active: 'bool', is_part_time: 'bool', learning_map_enabled: 'bool',
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
  self_eval_submissions: {
    columns: {
      id: 'text', staff_id: 'text', branch_id: 'text', eval_month: 'text', status: 'text',
      due_date: 'text', submitted_at: 'text', manager_interview_notes: 'text', interview_date: 'text',
      manager_signed_at: 'text', created_at: 'text', updated_at: 'text',
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
