const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const dateInput = document.getElementById('dateInput');
dateInput.value = new Date().toISOString().slice(0, 10);
dateInput.addEventListener('change', load);

load();

async function load() {
  const listEl = document.getElementById('list');
  document.getElementById('detail').innerHTML = '';
  listEl.innerHTML = '<p class="empty-state">載入中…</p>';

  const res = await fetch(`${API}/api/manager-worksheet/hq-list?date=${dateInput.value}`);
  const branches = await res.json();

  listEl.innerHTML = branches.map((b) => `
    <div class="branch-block">
      <p style="font-weight:600;font-size:15px;margin:0 0 6px;">${b.branch_name}</p>
      ${b.submissions.length === 0
        ? '<p class="empty-state">今天還沒有主管交表。</p>'
        : b.submissions.map((s) => `
          <div class="sub-row" data-id="${s.id}" style="cursor:pointer;">
            <span>${s.staff?.name || ''}（${s.shift_type || ''}）</span>
            <span style="color:var(--accent);">已送出 →</span>
          </div>`).join('')}
    </div>`).join('');

  listEl.querySelectorAll('[data-id]').forEach((row) => {
    row.addEventListener('click', () => showDetail(row.dataset.id));
  });
}

async function showDetail(id) {
  const res = await fetch(`${API}/api/manager-worksheet/${id}/detail`);
  const { submission: s, answers } = await res.json();

  const checklistHtml = answers.map((a) => `
    <p style="font-size:12.5px;margin:4px 0;">${a.checked ? '✓' : '☐'} ${a.template?.item_text || ''}</p>`).join('');

  document.getElementById('detail').innerHTML = `
    <div class="branch-block">
      <p style="font-weight:600;margin:0 0 10px;">${s.staff?.name || ''} 的工作日報表詳情（${s.work_date}）</p>
      ${checklistHtml}
      <p style="font-size:12.5px;margin-top:10px;"><b>抽查項目：</b>${s.inspection_items || '—'}</p>
      <p style="font-size:12.5px;"><b>抽查結果：</b>${s.inspection_result || '—'}</p>
      <p style="font-size:12.5px;"><b>昨日未完成：</b>${s.yesterday_pending || '—'}</p>
      <p style="font-size:12.5px;"><b>今日已完成：</b>${s.today_completed || '—'}</p>
      <p style="font-size:12.5px;"><b>未完成交接：</b>${s.today_pending || '—'}</p>
      <p style="font-size:12.5px;"><b>現金抽查：</b>${s.cash_check_note || '—'}</p>
      <p style="font-size:12.5px;"><b>手工單單號：</b>${s.order_numbers || '—'}</p>
      <p style="font-size:12.5px;"><b>流程改善說明：</b>${s.process_improvement || '—'}</p>
      <p style="font-size:12.5px;"><b>服務品質異常說明：</b>${s.service_issue_note || '—'}</p>
      <p style="font-size:12.5px;"><b>其他異常說明：</b>${s.other_notes || '—'}</p>
    </div>`;
}
