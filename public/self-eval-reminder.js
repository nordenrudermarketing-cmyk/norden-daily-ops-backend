// 共用元件：檢查這位同仁上個月的自評表有沒有送出，沒送出就在頁面上插入提醒 banner
// 使用方式：頁面裡放一個 <div id="selfEvalReminder"></div>，並在 config.js 之後載入這個檔案
(async function checkSelfEvalReminder() {
  const staff = JSON.parse(localStorage.getItem('staff') || 'null');
  if (!staff) return;

  const slot = document.getElementById('selfEvalReminder');
  if (!slot) return;

  try {
    const API = window.APP_CONFIG.API_BASE_URL;
    const res = await fetch(`${API}/api/self-eval/form?staff_id=${staff.id}`);
    const data = await res.json();

    const isSubmitted = data.submission?.status === 'submitted' || data.submission?.status === 'reviewed';
    if (isSubmitted) return; // 已經送出，不用提醒

    const today = new Date().toISOString().slice(0, 10);
    const overdue = today > data.due_date;

    slot.innerHTML = `
      <div style="background:${overdue ? 'var(--danger-soft)' : '#fff6e0'};border:1px solid ${overdue ? '#e3bfae' : '#f0d98c'};border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:${overdue ? 'var(--danger)' : '#8a6d00'};">
        📋 ${overdue ? '已逾期！' : ''}你還沒有填寫 ${data.eval_month.slice(0, 7)} 的每月自評表，請於 ${data.due_date} 前完成
        <a href="self-eval.html" style="margin-left:8px;text-decoration:underline;color:inherit;">前往填寫 →</a>
      </div>`;
  } catch (e) {
    // 查不到就不顯示，不影響其他功能
  }
})();
