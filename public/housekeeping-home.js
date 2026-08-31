const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

// 分類定義：icon 用簡單的 SVG line icon，跟現有 Forest & Moss 風格搭配
const CATEGORIES = [
  {
    key: 'today',
    label: '今日任務',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/></svg>',
    items: [{ label: '今日房號打卡', url: 'checklist.html' }],
  },
  {
    key: 'maintenance',
    label: '保養',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 21 8 21 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5c0 1.5 1 2.5 1 2.5"/></svg>',
    items: [
      { label: '責任區／保養排程', url: 'zone-maintenance.html' },
      { label: '公區保養', url: 'public-area.html' },
    ],
  },
  {
    key: 'training',
    label: '培訓',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    items: [
      { label: '我的學習地圖', url: 'learning-map.html' },
      { label: '我的教學任務', url: 'my-teaching.html' },
    ],
  },
  {
    key: 'other',
    label: '其他',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    items: [
      { label: '每月自評表', url: 'self-eval.html' },
      { label: '獎金申覆', url: 'bonus-appeals.html' },
      { label: '臨時任務', url: 'adhoc-tasks.html' },
    ],
  },
];

const catButtonsEl = document.getElementById('catButtons');
const submenuEl = document.getElementById('submenu');
const submenuTitleEl = document.getElementById('submenuTitle');
const submenuItemsEl = document.getElementById('submenuItems');

document.getElementById('userFoot').textContent = staff.name;

let activeCategoryKey = null;
let activeUrl = null;

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
  activeCategoryKey = key;

  document.querySelectorAll('.cat-btn').forEach((b) => b.classList.toggle('active', b.dataset.key === key));

  submenuEl.style.display = 'block';
  submenuTitleEl.textContent = cat.label;
  submenuItemsEl.innerHTML = '';
  cat.items.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'submenu-item';
    btn.textContent = item.label;
    btn.dataset.url = item.url;
    btn.addEventListener('click', () => {
      submenuItemsEl.querySelectorAll('.submenu-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadContent(item.url);
    });
    submenuItemsEl.appendChild(btn);
  });
  // 預設打開第一項
  // 不自動點第一項，避免剛進頁面就被導走，讓使用者自己選
}

function loadContent(url) {
  activeUrl = url;
  window.location.href = url;
}

// 預設進來就開「今日任務」
selectCategory('today');

// ---------- 功能開關：總公司關掉的功能不要出現在這個選單 ----------
(async function applyFeatureToggles() {
  const API = window.APP_CONFIG?.API_BASE_URL;
  if (!API) return;

  let disabledPages = [];
  try {
    const res = await fetch(`${API}/api/features`);
    disabledPages = (await res.json())?.disabled_pages || [];
  } catch (e) { return; } // 查不到就維持全部顯示
  if (disabledPages.length === 0) return;

  CATEGORIES.forEach((c) => { c.items = c.items.filter((it) => !disabledPages.includes(it.url)); });

  const emptyKeys = CATEGORIES.filter((c) => c.items.length === 0).map((c) => c.key);
  catButtonsEl.querySelectorAll('.cat-btn').forEach((b) => {
    if (emptyKeys.includes(b.dataset.key)) b.remove();
  });

  const stillActive = catButtonsEl.querySelector('.cat-btn.active');
  const firstLeft = catButtonsEl.querySelector('.cat-btn');
  if (stillActive) selectCategory(stillActive.dataset.key);
  else if (firstLeft) selectCategory(firstLeft.dataset.key);
  else submenuEl.style.display = 'none';
})();
