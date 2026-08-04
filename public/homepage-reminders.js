// 共用元件：
// ① 檢查這位同仁有沒有待完成的教學任務，有的話在頁面上方插入提醒 banner
// ② 檢查這位同仁有沒有被指派過學習項目，沒有就把「我的學習地圖」連結隱藏起來
// 使用方式：頁面裡放 <div id="teachingReminder"></div>，並把「我的學習地圖」連結加上 id="learningMapLink" 且預設 style="display:none"
(async function homepageReminders() {
  const staff = JSON.parse(localStorage.getItem('staff') || 'null');
  if (!staff) return;
  const API = window.APP_CONFIG.API_BASE_URL;

  // ① 教學待辦提醒
  const reminderSlot = document.getElementById('teachingReminder');
  if (reminderSlot) {
    try {
      const res = await fetch(`${API}/api/training/my-teaching?trainer_id=${staff.id}`);
      const tasks = await res.json();
      if (tasks && tasks.length > 0) {
        const dueDates = tasks.map((t) => t.due_date).filter(Boolean).sort();
        const nearestDue = dueDates[0];
        const today = new Date().toISOString().slice(0, 10);
        const overdue = nearestDue && today > nearestDue;
        reminderSlot.innerHTML = `
          <div style="background:${overdue ? 'var(--danger-soft)' : '#fff6e0'};border:1px solid ${overdue ? '#e3bfae' : '#f0d98c'};border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:${overdue ? 'var(--danger)' : '#8a6d00'};">
            📋 你有 ${tasks.length} 項教學任務待完成${nearestDue ? `，最近期限：${nearestDue}${overdue ? '（已逾期）' : ''}` : ''}
            <a href="my-teaching.html" style="margin-left:8px;text-decoration:underline;color:inherit;">前往查看 →</a>
          </div>`;
      }
    } catch (e) { /* 查不到就不顯示 */ }
  }

  // ② 學習地圖連結：只有被指派過的人才顯示
  const learningLink = document.getElementById('learningMapLink');
  if (learningLink) {
    try {
      const res = await fetch(`${API}/api/training/has-assignments?staff_id=${staff.id}`);
      const data = await res.json();
      if (data.has_assignments) learningLink.style.display = 'inline';
    } catch (e) { /* 查不到就維持隱藏 */ }
  }
})();
