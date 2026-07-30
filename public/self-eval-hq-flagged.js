const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CATEGORY_LABEL = { common: '共同', management: '主管', housekeeping: '房務', frontdesk: '客務' };

function prevMonthStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

const monthInput = document.getElementById('monthInput');
monthInput.value = prevMonthStr();
monthInput.addEventListener('change', load);

load();

async function load() {
  const listEl = document.getElementById('flagList');
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const evalMonth = `${monthInput.value}-01`;
  const res = await fetch(`${API}/api/self-eval/hq-flagged?eval_month=${evalMonth}`);
  const items = await res.json();

  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty-state">這個月沒有已審閱完成且被勾「否」的項目。</p>';
    return;
  }

  listEl.innerHTML = '';
  items.forEach((it) => {
    const card = document.createElement('div');
    card.className = 'flag-card';
    card.innerHTML = `
      <div class="top-row">
        <span class="who">${it.branch_name}・${it.staff_name}</span>
        <span class="month">${CATEGORY_LABEL[it.template?.category] || ''}・${it.eval_month?.slice(0, 7)}</span>
      </div>
      <p class="q">${it.template?.question_zh || ''}</p>
      <div class="ans-box ${it.staff_answer === 'no' ? 'no' : ''}">人員自檢：${it.staff_answer === 'yes' ? '是' : it.staff_answer === 'no' ? '否' : '—'}${it.staff_note ? '　說明：' + it.staff_note : ''}</div>
      <div class="ans-box ${it.manager_answer === 'no' ? 'no' : ''}">主管確認：${it.manager_answer === 'yes' ? '是' : it.manager_answer === 'no' ? '否' : '—'}${it.manager_note ? '　說明：' + it.manager_note : ''}</div>
    `;
    listEl.appendChild(card);
  });
}
