const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const CATEGORIES = [
  {
    key: 'overview', label: '總覽',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/></svg>',
    items: [{ label: '總公司儀表板', url: 'hq-dashboard.html' }],
  },
  {
    key: 'branches', label: '各館管理',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18M7 15l4-4 3 3 5-6"/></svg>',
    items: [
      { label: '自評題目管理', url: 'self-eval-templates.html' },
      { label: '自評異常彙總', url: 'self-eval-hq-flagged.html' },
      { label: '各館週報', url: 'weekly-report.html' },
      { label: '各館主管工作日報表', url: 'manager-worksheet-hq.html' },
    ],
  },
  {
    key: 'account', label: '帳號管理',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    items: [
      { label: '密碼管理', url: 'manage-passwords.html' },
      { label: '功能開關', url: 'feature-toggles.html' },
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
