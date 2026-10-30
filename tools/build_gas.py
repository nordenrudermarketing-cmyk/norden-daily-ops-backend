"""
把網頁（public/）和 Apps Script 程式（gas/）組合成可以上傳到 Apps Script 的檔案，輸出到 build/gas/。

為什麼需要這一步：
  Apps Script 只接受兩種檔案：.gs（程式）和 .html（網頁）。
  我們的網頁原本是「一個 .html ＋ 好幾個 .js / .css」，這裡把它們合併成一個 .html，
  並在最前面塞進轉接器（gas/client/shim.js），再把換頁的寫法改成 Apps Script 能用的樣子。

用法（在專案根目錄）：
  python tools/build_gas.py

public/ 裡的原始檔不會被修改；每次執行都會清空 build/gas/ 重新產生。
"""

import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
GAS = ROOT / "gas"
OUT = ROOT / "build" / "gas"

# 已經搬到 Apps Script 的頁面（第 1 階段：自評表、帳號管理、功能開關＋登入）。
# 其他功能要重新開放時，把頁面加進來，並在 gas/Catalog.gs 把該功能標成 ported: true。
PAGES = [
    "index",
    "self-eval",
    "self-eval-review",
    "self-eval-templates",
    "self-eval-hq-flagged",
    "hq-dashboard",
    "feature-toggles",
    "manage-passwords",
    "org-departments",
    "org-roles",
]

SCRIPT_TAG = re.compile(r'<script\s+src="([^"]+)"\s*>\s*</script>', re.I)
INLINE_SCRIPT = re.compile(r"(<script>)(.*?)(</script>)", re.I | re.S)
STYLE_LINK = re.compile(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', re.I)

warnings = []


def transform_js(js: str, where: str) -> str:
    """把 Railway 版的換頁寫法改成轉接器的寫法。"""
    # window.location.href = X;  →  __go(X);
    js = re.sub(r"window\.location\.href\s*=\s*([^;\n]+?)\s*;", r"__go(\1);", js)
    # window.location.replace(X)  →  __go.replace(X)
    js = js.replace("window.location.replace(", "__go.replace(")
    # window.location.pathname  →  __pathname()
    js = js.replace("window.location.pathname", "__pathname()")
    # 內嵌在 <script> 裡時，字串或註解中的 </script 會讓瀏覽器提早結束這段程式
    js = re.sub(r"</script", r"<\\/script", js, flags=re.I)

    leftover = re.findall(r"(?:window\.)?location\.(?:href|replace|assign|reload|search|pathname)", js)
    if leftover:
        warnings.append(f"{where}：還有沒轉換到的換頁寫法 {sorted(set(leftover))}，在 Apps Script 裡會失效")
    return js


def read(path: Path) -> str:
    if not path.exists():
        sys.exit(f"找不到檔案：{path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def build_page(name: str, shim: str) -> str:
    html = read(PUBLIC / f"{name}.html")

    html = STYLE_LINK.sub(lambda m: f"<style>\n{read(PUBLIC / m.group(1))}\n</style>", html)
    html = INLINE_SCRIPT.sub(
        lambda m: m.group(1) + transform_js(m.group(2), f"{name}.html 內嵌程式") + m.group(3), html
    )
    html = SCRIPT_TAG.sub(
        lambda m: f"<script>\n{transform_js(read(PUBLIC / m.group(1)), m.group(1))}\n</script>", html
    )

    head = (
        f"<script>window.__PAGE__ = {json.dumps(name + '.html')};</script>\n"
        f"<script>\n{shim}\n</script>\n"
    )
    if "<head>" not in html:
        sys.exit(f"{name}.html 沒有 <head>，無法插入轉接器")
    return html.replace("<head>", "<head>\n" + head, 1)


def git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return "unknown"


def main() -> None:
    # 只清空裡面的檔案、不刪資料夾本身（OneDrive 同步中的資料夾常常刪不掉）
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.iterdir():
        if old.is_dir():
            shutil.rmtree(old)
        else:
            old.unlink()

    # Apps Script 程式與外框
    for src in sorted(GAS.iterdir()):
        if src.is_file() and src.suffix in (".gs", ".html", ".json"):
            shutil.copy2(src, OUT / src.name)

    shim = read(GAS / "client" / "shim.js")
    for name in PAGES:
        (OUT / f"page_{name}.html").write_text(build_page(name, shim), encoding="utf-8")

    taipei_now = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M")
    (OUT / "Pages.gs").write_text(
        "// 這個檔案由 tools/build_gas.py 自動產生，不要手動修改\n"
        f"const PAGE_NAMES = {json.dumps(PAGES, ensure_ascii=False)};\n"
        f"const BUILD_INFO = {json.dumps({'commit': git_commit(), 'built_at': taipei_now}, ensure_ascii=False)};\n",
        encoding="utf-8",
    )

    files = sorted(p.name for p in OUT.iterdir())
    print(f"已產生 {len(files)} 個檔案到 build/gas/：")
    for f in files:
        print("  ", f)
    if warnings:
        print("\n⚠ 注意：")
        for w in warnings:
            print("  ", w)


if __name__ == "__main__":
    main()
