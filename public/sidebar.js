// 共用側邊選單元件
// 使用方式：任何頁面在 </body> 前加一行 <script src="sidebar.js"></script> 就會自動運作
// 不需要 iframe，是真的把選單「畫」在每一頁上，所以 Safari 也完全沒問題

(async function () {
  const staff = JSON.parse(localStorage.getItem('staff') || 'null');
  if (!staff) return; // 沒登入的頁面（例如 index.html）不顯示側邊選單

  const roleName = staff.roles?.name || '';
  const currentPage = window.location.pathname.split('/').pop();

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 21 8 21 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5c0 1.5 1 2.5 1 2.5"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 0 2.5-2.5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.7 3.86a2 2 0 0 0-3.4 0z"/></svg>',
    branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18M7 15l4-4 3 3 5-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  };

  const NAV_SETS = {
    housekeeping: [
      { label: '今日任務', icon: 'home', items: [
        { label: '今日房號打卡', url: 'checklist.html' },
        { label: '今日房號分配（小隊長）', url: 'assign.html' },
        { label: '公區任務分配（小隊長）', url: 'public-area-assign.html' },
      ] },
      { label: '保養', icon: 'leaf', items: [
        { label: '責任區／保養排程', url: 'zone-maintenance.html' },
        { label: '公區保養', url: 'public-area.html' },
      ] },
      { label: '培訓', icon: 'book', items: [
        { label: '我的學習地圖', url: 'learning-map.html' },
        { label: '我的教學任務', url: 'my-teaching.html' },
      ] },
      { label: '其他', icon: 'dots', items: [
        { label: '每月自評表', url: 'self-eval.html' },
        { label: '獎金申覆', url: 'bonus-appeals.html' },
        { label: '臨時任務', url: 'adhoc-tasks.html' },
      ] },
    ],
    frontdesk: [
      { label: '今日任務', icon: 'home', items: [
        { label: '今日班別任務', url: 'shift.html' },
        { label: '巡房檢查', url: 'inspect.html' },
      ] },
      { label: '每日日誌', icon: 'doc', items: [
        { label: '客務日誌', url: 'daily-frontdesk-log.html' },
        { label: '客訴登記', url: 'complaint-register.html' },
      ] },
      { label: '培訓考核', icon: 'book', items: [
        { label: '我的學習地圖', url: 'learning-map.html' },
        { label: '我的教學任務', url: 'my-teaching.html' },
        { label: '櫃檯考核筆試', url: 'written-exam-take.html' },
      ] },
      { label: '其他', icon: 'dots', items: [
        { label: '每月自評表', url: 'self-eval.html' },
        { label: '我的例行事項', url: 'routine-tasks.html' },
        { label: '個人清潔配額', url: 'staff-cleaning.html' },
        { label: '獎金申覆', url: 'bonus-appeals.html' },
        { label: '臨時任務', url: 'adhoc-tasks.html' },
        { label: '交班表（台中館）', url: 'handover.html' },
      ] },
    ],
    manager: [
      { label: '總覽', icon: 'home', items: [{ label: '儀表板', url: 'dashboard.html' }] },
      { label: '排班人力', icon: 'calendar', items: [
        { label: '排班表', url: 'schedule.html' },
        { label: '從 Excel 匯入班表', url: 'schedule-import.html' },
      ] },
      { label: '獎金', icon: 'coin', items: [{ label: '獎金申覆審核', url: 'bonus-appeals.html' }] },
      { label: '任務管理', icon: 'leaf', items: [
        { label: '保養排程管理', url: 'zone-maintenance.html' },
        { label: '公區任務分配', url: 'public-area-assign.html' },
        { label: '例行事項管理', url: 'routine-tasks-manage.html' },
        { label: '臨時任務', url: 'adhoc-tasks.html' },
        { label: '店經理巡館', url: 'manager-checklist.html' },
        { label: '客務任務範本管理', url: 'templates.html' },
      ] },
      { label: '培訓考核', icon: 'book', items: [{ label: '指派培訓', url: 'learning-assign.html' }] },
      { label: '異常巡查', icon: 'alert', items: [
        { label: '異常處理', url: 'issues.html' },
        { label: '評論回報紀錄', url: 'review-logs-review.html' },
      ] },
      { label: '日報紀錄', icon: 'doc', items: [
        { label: '開班收班日報', url: 'manager-daily-report.html' },
        { label: '主管每日工作表', url: 'manager-worksheet.html' },
      ] },
      { label: '自評', icon: 'dots', items: [
        { label: '我的每月自評表', url: 'self-eval.html' },
        { label: '審閱同仁自評表', url: 'self-eval-review.html' },
      ] },
    ],
    hq: [
      { label: '總覽', icon: 'home', items: [{ label: '總公司儀表板', url: 'hq-dashboard.html' }] },
      { label: '各館管理', icon: 'branch', items: [
        { label: '自評題目管理', url: 'self-eval-templates.html' },
        { label: '自評異常彙總', url: 'self-eval-hq-flagged.html' },
        { label: '各館週報', url: 'weekly-report.html' },
        { label: '各館主管工作日報表', url: 'manager-worksheet-hq.html' },
      ] },
      { label: '帳號管理', icon: 'lock', items: [{ label: '密碼管理', url: 'manage-passwords.html' }] },
    ],
  };

  let navKey = null;
  if (roleName.includes('房務')) navKey = 'housekeeping';
  else if (roleName === '客務人員') navKey = 'frontdesk';
  else if (roleName === '店經理') navKey = 'manager';
  else if (roleName === '總公司') navKey = 'hq';
  if (!navKey) return;

  const categories = NAV_SETS[navKey];

  // 交班表、店經理巡館只有台中館在用，其他館別要拿掉
  const API_BASE = window.APP_CONFIG?.API_BASE_URL;
  let branchName = null;
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/staff/password-status?branch_id=${staff.branch_id}`);
      const list = await res.json();
      branchName = list?.[0]?.branch_name || null;
    } catch (e) { /* 查不到就保守顯示全部，不隱藏 */ }
  }

  if (branchName && branchName !== '台中館') {
    const tcOnlyUrls = ['handover.html', 'manager-checklist.html'];
    categories.forEach((cat) => {
      cat.items = cat.items.filter((it) => !tcOnlyUrls.includes(it.url));
    });
  }

  // 房務：只有「今天排班表指定的小隊長」才看得到房號分配／公區任務分配這兩項
  if (navKey === 'housekeeping' && API_BASE) {
    let isTeamLeadToday = false;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await fetch(`${API_BASE}/api/schedule/team-lead-today?branch_id=${staff.branch_id}&date=${todayStr}`);
      const result = await res.json();
      isTeamLeadToday = result.staff_id === staff.id;
    } catch (e) { /* 查不到就保守隱藏，不顯示分配功能 */ }

    if (!isTeamLeadToday) {
      const leadOnlyUrls = ['assign.html', 'public-area-assign.html'];
      categories.forEach((cat) => {
        cat.items = cat.items.filter((it) => !leadOnlyUrls.includes(it.url));
      });
    }
  }

  const allUrls = new Set();
  categories.forEach((c) => c.items.forEach((it) => allUrls.add(it.url)));

  let defaultCategoryIdx = 0;
  categories.forEach((c, i) => { if (c.items.some((it) => it.url === currentPage)) defaultCategoryIdx = i; });

  const style = document.createElement('style');
  style.textContent = `
    body { margin-left: 226px !important; }
    #ldSidebarWrap { position: fixed; top: 0; left: 0; bottom: 0; display: flex; z-index: 9999; font-family: inherit; }
    #ldSidebarWrap .ld-sidebar { width: 76px; background: var(--surface, #fff); border-right: 1px solid var(--line, #e3e0d8); display: flex; flex-direction: column; align-items: center; padding: 16px 0; height: 100%; overflow-y: auto; }
    #ldSidebarWrap .ld-logo { font-size: 11px; font-weight: 700; color: var(--accent, #2F5D4F); margin-bottom: 20px; text-align: center; line-height: 1.3; }
    #ldSidebarWrap .ld-cat-btn { width: 52px; height: 52px; border-radius: 14px; border: none; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; margin-bottom: 8px; color: var(--ink-soft, #6B6F63); }
    #ldSidebarWrap .ld-cat-btn svg { width: 20px; height: 20px; }
    #ldSidebarWrap .ld-cat-btn span { font-size: 9px; }
    #ldSidebarWrap .ld-cat-btn.active { background: var(--accent-soft, #E4EDE9); color: var(--accent, #2F5D4F); }
    #ldSidebarWrap .ld-submenu { width: 150px; background: var(--surface, #fff); border-right: 1px solid var(--line, #e3e0d8); padding: 16px 10px; height: 100%; overflow-y: auto; position: relative; }
    #ldSidebarWrap .ld-submenu h3 { font-size: 11.5px; color: var(--ink-soft, #6B6F63); margin: 0 0 10px; font-weight: 600; }
    #ldSidebarWrap .ld-sub-item { display: block; width: 100%; text-align: left; padding: 9px 10px; border-radius: 9px; border: none; background: transparent; font-size: 12.5px; color: var(--ink, #23291F); cursor: pointer; margin-bottom: 4px; }
    #ldSidebarWrap .ld-sub-item.active { background: var(--accent, #2F5D4F); color: #fff; }
    #ldSidebarWrap .ld-foot { margin-top: auto; text-align: center; font-size: 10px; color: var(--ink-soft, #6B6F63); padding-top: 10px; }
    @media (max-width: 700px) {
      body { margin-left: 0 !important; padding-top: 60px !important; }
      #ldSidebarWrap { top: 0; left: 0; right: 0; bottom: auto; flex-direction: column; }
      #ldSidebarWrap .ld-sidebar { width: 100%; flex-direction: row; height: auto; padding: 6px; overflow-x: auto; align-items: center; }
      #ldSidebarWrap .ld-logo { display: none; }
      #ldSidebarWrap .ld-foot { margin-top: 0; margin-left: auto; padding-top: 0; flex-shrink: 0; display: flex; align-items: center; }
      #ldSidebarWrap .ld-foot > div:last-child { display: none; } /* 手機版隱藏姓名文字，省空間，只留登出鍵 */
      #ldSidebarWrap .ld-submenu { position: fixed; top: 56px; left: 0; right: 0; width: 100%; height: auto; max-height: 60vh; box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
      #ldSidebarWrap .ld-submenu-close { display: block !important; }
    }
    .ld-submenu-close { display: none; background: none; border: none; color: var(--ink-soft, #6B6F63); font-size: 20px; cursor: pointer; position: absolute; top: 8px; right: 10px; padding: 4px; }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'ldSidebarWrap';

  const sidebar = document.createElement('div');
  sidebar.className = 'ld-sidebar';
  sidebar.innerHTML = '<div class="ld-logo">路得<br>行旅</div>';

  const submenu = document.createElement('div');
  submenu.className = 'ld-submenu';

  let openIdx = defaultCategoryIdx;

  categories.forEach((cat, idx) => {
    const btn = document.createElement('button');
    btn.className = 'ld-cat-btn' + (idx === defaultCategoryIdx ? ' active' : '');
    btn.innerHTML = `${ICONS[cat.icon]}<span>${cat.label}</span>`;
    btn.addEventListener('click', () => {
      // 手機版：再點一次目前開著的分類，就收合子選單
      if (window.innerWidth <= 700 && openIdx === idx && submenu.style.display !== 'none') {
        closeSubmenu();
        return;
      }
      renderSubmenu(idx);
    });
    sidebar.appendChild(btn);
  });

  const foot = document.createElement('div');
  foot.className = 'ld-foot';
  foot.innerHTML = `
    <button id="ldLogoutBtn" style="background:none;border:none;color:var(--ink-soft, #6B6F63);font-size:11px;text-decoration:underline;cursor:pointer;padding:0 0 6px;display:block;width:100%;">登出</button>
    <div>${staff.name}</div>`;
  sidebar.appendChild(foot);
  document.getElementById && setTimeout(() => {
    const btn = document.getElementById('ldLogoutBtn');
    if (btn) btn.addEventListener('click', () => {
      if (confirm('確定要登出嗎？')) {
        localStorage.removeItem('staff');
        window.location.href = 'index.html';
      }
    });
  }, 0);

  function closeSubmenu() {
    submenu.style.display = 'none';
    sidebar.querySelectorAll('.ld-cat-btn').forEach((b) => b.classList.remove('active'));
  }

  function renderSubmenu(idx) {
    openIdx = idx;
    submenu.style.display = 'block';
    sidebar.querySelectorAll('.ld-cat-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
    const cat = categories[idx];
    submenu.innerHTML = `<button class="ld-submenu-close" aria-label="收合">✕</button><h3>${cat.label}</h3>`;
    submenu.querySelector('.ld-submenu-close').addEventListener('click', closeSubmenu);
    cat.items.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'ld-sub-item' + (item.url === currentPage ? ' active' : '');
      btn.textContent = item.label;
      btn.addEventListener('click', () => { window.location.href = item.url; });
      submenu.appendChild(btn);
    });
  }
  renderSubmenu(defaultCategoryIdx);

  wrap.appendChild(sidebar);
  wrap.appendChild(submenu);
  document.body.prepend(wrap);

  function hideKnownLinks() {
    allUrls.forEach((href) => {
      document.querySelectorAll(`a[href="${href}"]`).forEach((a) => { a.style.display = 'none'; });
    });
  }
  hideKnownLinks();

  // 有些連結是頁面載入後才用 JS 動態產生的（例如「責任區保養排程」那種），
  // 剛剛那次隱藏跑的時候可能它還沒出現，所以持續監看 DOM 變化，
  // 只要之後有新連結冒出來，一樣會被抓到隱藏
  const observer = new MutationObserver(hideKnownLinks);
  observer.observe(document.body, { childList: true, subtree: true });

  // ---------- 店經理專用：一登入就提醒有沒有待處理的申覆／異常 ----------
  if (navKey === 'manager') {
    const API = window.APP_CONFIG?.API_BASE_URL;
    if (API) {
      (async () => {
        const alerts = [];
        try {
          const res = await fetch(`${API}/api/bonus-appeals/pending?branch_id=${staff.branch_id}`);
          const list = await res.json();
          const pendingCount = (list || []).filter((a) => a.status === 'pending').length;
          if (pendingCount > 0) alerts.push({ text: `有 ${pendingCount} 筆獎金申覆待審核`, url: 'bonus-appeals.html' });
        } catch (e) { /* 查不到就跳過 */ }

        try {
          const res = await fetch(`${API}/api/issues/list?branch_id=${staff.branch_id}`);
          const list = await res.json();
          const unresolvedCount = (list || []).filter((i) => !i.resolved).length;
          if (unresolvedCount > 0) alerts.push({ text: `有 ${unresolvedCount} 筆異常尚未處理`, url: 'issues.html' });
        } catch (e) { /* 查不到就跳過 */ }

        if (alerts.length === 0) return;

        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;top:0;left:226px;right:0;z-index:9998;background:#fdecea;border-bottom:1px solid #e3bfae;padding:10px 20px;font-size:13px;color:#b3462c;display:flex;gap:16px;flex-wrap:wrap;align-items:center;';
        banner.innerHTML = alerts.map((a) => `⚠ ${a.text} <a href="${a.url}" style="color:#b3462c;text-decoration:underline;margin-right:12px;">前往處理 →</a>`).join('');
        document.body.prepend(banner);
        document.body.style.paddingTop = '48px';
      })();
    }
  }
})();
