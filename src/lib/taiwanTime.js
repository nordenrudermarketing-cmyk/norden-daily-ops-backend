// ============================================================
// 台灣時間的日期
//
// Railway 伺服器跑在 UTC，直接用 new Date() 算日期的話，
// 台灣時間早上 8 點以前還會被當成前一天，所以日期一律先換算成台灣時間。
// 前端要判斷「今天」、逾期時，也請用伺服器回傳的日期，不要用瀏覽器的 toISOString()。
// ============================================================

const taipeiFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
});

// 回傳台灣時間的 'YYYY-MM-DD'；沒給值就是今天
export function taipeiDate(value = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(taipeiFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
