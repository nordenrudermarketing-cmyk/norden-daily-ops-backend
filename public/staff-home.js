// 我的總覽（現場人員、人事行政登入後的首頁）：我還有哪些事要做（todos.js 畫）＋每個月的時程
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

if (!staff) {
  window.location.href = 'index.html';
} else {
  document.getElementById('hello').textContent = `${staff.name}，你好`;
  // 這裡只是顯示今天日期與時程提示，用手機的日期就好
  const now = new Date();
  document.getElementById('todayLine').textContent = `今天 ${now.getMonth() + 1}/${now.getDate()}（${WEEKDAYS[now.getDay()]}）`;
  // 人事行政不用填自評：時程改成看同仁進度與評核彙整
  if (window.accountLevelOf(staff) === 'hq_admin') {
    document.getElementById('plan').innerHTML = `
      <li data-from="1" data-to="5">1～5 號：上個月的評核彙整、填客戶評價、送審</li>
      <li data-from="6" data-to="20">1～20 號：同仁填自評、主管面談</li>
      <li data-from="21" data-to="31">21 號～月底：每月評核評分</li>`;
  }
  document.querySelectorAll('#plan li').forEach((li) => {
    const day = now.getDate();
    if (day >= Number(li.dataset.from) && day <= Number(li.dataset.to)) li.classList.add('now');
  });
}
