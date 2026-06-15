"""Render Ocean post slides — 1080x1350."""
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright

POST_DIR = Path(__file__).parent
ASSETS   = POST_DIR.parent.parent / "assets" / "brand"
OUT_DIR  = POST_DIR / "output"
OUT_DIR.mkdir(exist_ok=True)

def b64(path: Path) -> str:
    ext = path.suffix.lstrip(".").lower()
    if ext in ("jpg", "jpeg"): ext = "jpeg"
    else: ext = "png"
    return f"data:image/{ext};base64," + base64.b64encode(path.read_bytes()).decode()

MAIN_TPL  = b64(ASSETS / "main_slide_template.png")
STORY_TPL = b64(ASSETS / "story_slide_template.png")
LOGO      = b64(ASSETS / "logo_with_divider.png")
FOUNDERS  = b64(POST_DIR / "slide_01_bg.jpg")
TYPE2     = b64(ASSETS / "story_bg_type2.png")

slides = [
    {"name": "slide_01", "bg": FOUNDERS, "tpl": MAIN_TPL,  "logo": LOGO},
    {"name": "slide_02", "bg": TYPE2,    "tpl": STORY_TPL},
    {"name": "slide_03", "bg": FOUNDERS, "tpl": STORY_TPL},
    {"name": "slide_04", "bg": TYPE2,    "tpl": STORY_TPL},
    {"name": "slide_05", "bg": TYPE2,    "tpl": STORY_TPL},
    {"name": "slide_06", "bg": TYPE2,    "tpl": STORY_TPL},
    {"name": "slide_07", "bg": FOUNDERS, "tpl": STORY_TPL},
    {"name": "slide_08", "bg": FOUNDERS, "tpl": MAIN_TPL,  "logo": LOGO},
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
    page = ctx.new_page()

    for s in slides:
        html = (POST_DIR / f"{s['name']}.html").read_text(encoding="utf-8")
        html = html.replace("{{BG_IMAGE}}",       s["bg"])
        html = html.replace("{{TEMPLATE_IMAGE}}", s["tpl"])
        if "{{LOGO_IMAGE}}" in html:
            html = html.replace("{{LOGO_IMAGE}}", s.get("logo", ""))
        page.set_content(html, wait_until="networkidle")
        out = OUT_DIR / f"{s['name']}.png"
        page.screenshot(path=str(out), full_page=False, type="png")
        print(f"✅ {out.name}")

    ctx.close()
    browser.close()

print("Done.")
