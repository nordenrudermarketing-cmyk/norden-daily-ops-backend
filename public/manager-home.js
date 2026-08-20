const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CATEGORIES = [
  {
    key: 'overview', label: '總覽',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/></svg>',
    items: [{ label: '儀表板', url: 'dashboard.html' }],
  },
  {
    key: 'schedule', label: '排班人力',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    items: [
      { label: '排班表', url: 'schedule.html' },
      { label: '從 Excel 匯入班表', url: 'schedule-import.html' },
    ],
  },
  {
    key: 'bonus', label: '獎金',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 0 2.5-2.5"/></svg>',
    items: [{ label: '獎金申覆審核', url: 'bonus-appeals.html' }],
  },
  {
    key: 'tasks', label: '任務管理',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 21 8 21 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5c0 1.5 1 2.5 1 2.5"/></svg>',
    items: [
      { label: '保養排程管理', url: 'zone-maintenance.html' },
      { label: '公區任務分配', url: 'public-area-assign.html' },
      { label: '例行事項管理', url: 'routine-tasks-manage.html' },
      { label: '臨時任務', url: 'adhoc-tasks.html' },
      { label: '店經理巡館', url: 'manager-checklist.html' },
    ],
  },
  {
    key: 'training', label: '培訓考核',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    items: [{ label: '指派培訓', url: 'learning-assign.html' }],
  },
  {
    key: 'inspection', label: '異常巡查',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.7 3.86a2 2 0 0 0-3.4 0z"/></svg>',
    items: [
      { label: '異常處理', url: 'issues.html' },
      { label: '評論回報紀錄', url: 'review-logs-review.html' },
    ],
  },
  {
    key: 'reports', label: '日報紀錄',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>',
    items: [
      { label: '開班收班日報', url: 'manager-daily-report.html' },
      { label: '主管每日工作表', url: 'manager-worksheet.html' },
    ],
  },
];

const catButtonsEl = document.getElementById('catButtons');
const submenuEl = document.getElementById('submenu');
const submenuTitleEl = document.getElementById('submenuTitle');
const submenuItemsEl = document.getElementById('submenuItems');

document.getElementById('userFoot').textContent = staff.name;

CATEGORIES.forEach((cat) => {
  const btn = document.createElement('button');
  btn.className = 'cat-btn';
  btn.dataset.key = cat.key;
  btn.innerHTML = `${cat.icon}<span>${cat.label}</span>`;
  btn.addEventListener('click', () => selectCategory(cat.key));
  catButtonsEl.appendChild(btn);
});

function selectCategory(key) {
  const cat = CATEGORIES.find((c) => c.key === key);
  document.querySelectorAll('.cat-btn').forEach((b) => b.classList.toggle('active', b.dataset.key === key));

  submenuEl.style.display = 'block';
  submenuTitleEl.textContent = cat.label;
  submenuItemsEl.innerHTML = '';
  cat.items.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'submenu-item';
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      submenuItemsEl.querySelectorAll('.submenu-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      window.location.href = item.url;
    });
    submenuItemsEl.appendChild(btn);
  });
  // 不自動點第一項，避免剛進頁面就被導走，讓使用者自己選
}

selectCategory('overview');
