// ============================================================
// 轉接器（每一頁的最前面都會被自動塞進這段，由 tools/build_gas.py 負責）
//
// 原本的網頁是寫給 Railway 用的：用 fetch('/api/...') 跟後端要資料、用 window.location 換頁。
// 搬到 Apps Script 之後，網頁是放在外框（Shell.html）裡的一個內框裡：
//   - fetch('/api/...')   → 改送給外框，外框再用 google.script.run 呼叫 Apps Script 的 api()
//   - window.location 換頁 → build_gas.py 會改寫成 __go()，由外框載入下一頁
//   - <a href="xxx.html"> → 這裡攔截點擊，一樣交給外框換頁
// 所以 public/ 裡的網頁程式幾乎不用改。
// ============================================================
(function () {
  var app = window.parent && window.parent.__app;
  if (!app) {
    document.write('<p style="padding:20px;font-family:sans-serif">這個頁面要從系統網址打開才能使用。</p>');
    return;
  }

  // 換頁：__go('self-eval.html')；__go.replace(...) 不留上一頁的瀏覽紀錄
  window.__go = function (url) { app.navigate(String(url)); };
  window.__go.replace = function (url) { app.navigate(String(url), { replace: true }); };
  // 側邊選單用來判斷「現在在哪一頁」
  window.__pathname = function () { return '/' + window.__PAGE__; };

  // 剛登入時 staff 還沒存進 localStorage，登入後馬上呼叫的 API 先用這個
  var lastLoginToken = null;

  function currentToken() {
    try {
      var staff = JSON.parse(localStorage.getItem('staff') || 'null');
      if (staff && staff.token) return staff.token;
    } catch (e) { /* 壞掉的資料當作沒登入 */ }
    return lastLoginToken;
  }

  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var at = url.indexOf('/api/');
    if (at < 0) return realFetch.apply(this, arguments);

    init = init || {};
    var full = url.slice(at);
    var q = full.indexOf('?');
    var path = q < 0 ? full : full.slice(0, q);
    var query = {};
    if (q >= 0) new URLSearchParams(full.slice(q + 1)).forEach(function (v, k) { query[k] = v; });

    var body = null;
    if (init.body) {
      try { body = JSON.parse(init.body); } catch (e) { body = init.body; }
    }

    return app.api({
      method: (init.method || 'GET').toUpperCase(),
      path: path,
      query: query,
      body: body,
      token: currentToken(),
    }).then(function (r) {
      if (path === '/api/login' && r.status === 200 && r.body && r.body.token) lastLoginToken = r.body.token;
      // 登入過期或帳號被停用：清掉登入狀態，回登入頁
      if (r.status === 401 && path !== '/api/login') {
        localStorage.removeItem('staff');
        app.navigate('index.html', { replace: true });
      }
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: function () { return Promise.resolve(r.body); },
        text: function () { return Promise.resolve(typeof r.body === 'string' ? r.body : JSON.stringify(r.body)); },
      };
    });
  };

  // ---------- 彈出視窗的備援 ----------
  // 有些瀏覽器（LINE 內建瀏覽器、部分 App 裡的瀏覽器）會擋掉 confirm()／alert()，
  // 被擋時 confirm() 會「馬上」回傳 false，結果「確定要登出嗎？」「完成面談」這類按鈕按了都沒反應。
  // 這裡偵測到被擋（不到 50 毫秒就回來，人不可能那麼快按）時，改在頁面內顯示確認框；
  // 按「確定」之後，把剛才那一下點擊重新觸發一次，這次 confirm() 直接回傳 true。
  // 瀏覽器沒擋的話一切照舊，使用原本的彈出視窗。
  var lastClickTarget = null;
  var autoConfirm = false;
  var nativeConfirm = window.confirm.bind(window);
  var nativeAlert = window.alert.bind(window);

  document.addEventListener('click', function (e) { lastClickTarget = e.target; }, true);

  function showDialog(message, withCancel, onOk) {
    var overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(20,26,22,.45);display:flex;' +
      'align-items:center;justify-content:center;padding:20px;font-family:inherit;';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--surface,#fff);color:var(--ink,#23291F);border-radius:14px;max-width:360px;width:100%;' +
      'padding:22px 20px 16px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:15px;line-height:1.7;';
    var text = document.createElement('div');
    text.style.whiteSpace = 'pre-line';
    text.textContent = String(message);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:18px;';
    function button(label, primary, handler) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'font:inherit;font-size:14px;padding:8px 18px;border-radius:9px;cursor:pointer;' +
        (primary ? 'border:0;background:var(--accent,#2F5D4F);color:#fff;' : 'border:1px solid var(--line,#e3e0d8);background:transparent;color:inherit;');
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        overlay.remove();
        if (handler) handler();
      });
      return b;
    }
    if (withCancel) row.appendChild(button('取消', false, null));
    var ok = button(withCancel ? '確定' : '知道了', true, onOk);
    row.appendChild(ok);
    box.appendChild(text);
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    ok.focus();
  }

  window.confirm = function (message) {
    if (autoConfirm) {
      autoConfirm = false;
      return true;
    }
    var started = Date.now();
    var answer = false;
    try { answer = nativeConfirm(message); } catch (e) { answer = false; }
    if (answer || Date.now() - started > 50) return answer;
    var target = lastClickTarget;
    showDialog(message, true, function () {
      if (!target || !target.isConnected) return;
      autoConfirm = true;
      target.click();
      // 保險：重新觸發的那一下如果沒有用到 confirm()，也不要讓下一次確認被自動跳過
      setTimeout(function () { autoConfirm = false; }, 3000);
    });
    return false;
  };

  window.alert = function (message) {
    var started = Date.now();
    try { nativeAlert(message); } catch (e) { /* 被擋就改用頁面內的提示 */ }
    if (Date.now() - started < 50) showDialog(message, false, null);
  };

  // 攔截站內連結（例如 <a href="self-eval.html">），交給外框換頁
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^[a-z0-9-]+\.html([?#].*)?$/i.test(href)) {
      e.preventDefault();
      app.navigate(href);
    }
  }, true);
})();
