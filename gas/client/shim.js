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
