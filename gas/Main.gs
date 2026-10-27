// ============================================================
// 路得行旅 每日營運系統｜Apps Script 版進入點
//
// doGet    ：有人打開網址時回傳外框（Shell.html），?page= 決定先載入哪一頁
// getPage  ：外框換頁時跟這裡要那一頁的 HTML（由 tools/build_gas.py 產生的 page_xxx.html）
// api      ：所有資料存取的單一入口，見 Router.gs
// onOpen   ：試算表上方的「路得系統」選單，見 Setup.gs
// ============================================================

function doGet(e) {
  const params = (e && e.parameter) || {};
  const page = /^[a-z0-9-]+$/.test(params.page || '') ? params.page : 'index';
  const query = Object.assign({}, params);
  delete query.page;

  const template = HtmlService.createTemplateFromFile('Shell');
  // 網址參數是使用者可以亂改的，塞進 <script> 前把 < 換掉，避免被插入程式碼
  template.initialJson = JSON.stringify({ page: page, query: query }).replace(/</g, '\\u003c');
  template.isStaging = isStaging_();

  return template.evaluate()
    .setTitle('路得行旅 每日營運系統')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function getPage(name) {
  if (PAGE_NAMES.indexOf(name) >= 0) {
    return HtmlService.createHtmlOutputFromFile('page_' + name).getContent();
  }
  // 還沒搬到 Apps Script 的頁面（或打錯的網址）：顯示說明，再帶回自評表
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:-apple-system,\'PingFang TC\',\'Noto Sans TC\',sans-serif;color:#6b6f63;' +
    'font-size:14px;line-height:1.8;text-align:center;padding:80px 20px;background:#F7F5F0;">' +
    '這項功能還沒搬到新系統，正在帶你回自評表…' +
    '<script>setTimeout(function () {' +
    'var app = window.parent.__app; var loggedIn = !!localStorage.getItem("staff");' +
    'app.navigate(loggedIn ? "self-eval.html" : "index.html", { replace: true });' +
    '}, 1500);</script></body></html>';
}

// 試算表名稱有「測試」兩個字就是測試站（外框右下角會顯示「測試站」）
function isStaging_() {
  return getDb_().getName().indexOf('測試') >= 0;
}
