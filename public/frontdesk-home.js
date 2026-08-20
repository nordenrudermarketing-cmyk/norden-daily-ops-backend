const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CATEGORIES = [
  {
    key: 'today', label: '今日任務',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/></svg>',
    items: [
      { label: '今日班別任務', url: 'shift.html' },
      { label: '巡房檢查', url: 'inspect.html' },
    ],
  },
  {
    key: 'daily', label: '每日日誌',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>',
    items: [
      { label: '客務日誌（掃單/評論/NO SHOW）', url: 'daily-frontdesk-log.html' },
      { label: '客訴登記', url: 'complaint-register.html' },
    ],
  },
  {
    key: 'training', label: '培訓考核',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    items: [
      { label: '我的學習地圖', url: 'learning-map.html' },
      { label: '我的教學任務', url: 'my-teaching.html' },
      { label: '櫃檯考核筆試', url: 'written-exam-take.html' },
    ],
  },
  {
    key: 'other', label: '其他',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    items: [
      { label: '每月自評表', url: 'self-eval.html' },
      { label: '我的例行事項', url: 'routine-tasks.html' },
      { label: '個人清潔配額', url: 'staff-cleaning.html' },
      { label: '獎金申覆', url: 'bonus-appeals.html' },
      { label: '臨時任務', url: 'adhoc-tasks.html' },
      { label: '交班表（台中館）', url: 'handover.html' },
    ],
  },
];

const catButtonsEl = document.getElementById('catButtons');
const submenuEl = document.getElementById('submenu');
const submenuTitleEl = document.getElementById('submenuTitle');
const submenuItemsEl = document.getElementById('submenuItems');
const frame = document.getElementById('contentFrame');

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

  if (cat.items.length === 1) {
    submenuEl.style.display = 'none';
    frame.src = cat.items[0].url;
    return;
  }

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
      frame.src = item.url;
    });
    submenuItemsEl.appendChild(btn);
  });
  submenuItemsEl.firstElementChild.click();
}

selectCategory('today');
