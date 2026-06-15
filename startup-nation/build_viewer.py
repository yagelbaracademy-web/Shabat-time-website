"""Build HTML viewer showing scored articles, top picks first.

Reads output/articles_scored.json (preferred) or output/articles_latest.json.
Shows up to 50 highest-scoring articles with categories, hooks, and filter buttons.

Run: python3 build_viewer.py
"""

import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from html import escape

SCRIPT_DIR = Path(__file__).parent
SCORED = SCRIPT_DIR / "output" / "articles_scored.json"
LATEST = SCRIPT_DIR / "output" / "articles_latest.json"
OUTPUT = SCRIPT_DIR / "output" / "viewer.html"

CATEGORY_META = {
    "ISRAELI_PRIDE":  ("🇮🇱", "גאווה ישראלית",  "#2563eb"),
    "FUNDING":        ("💰", "גיוס/השקעה",      "#16a34a"),
    "LAUNCH":         ("🚀", "השקה",            "#9333ea"),
    "GLOBAL_TECH":    ("🌍", "טק גלובלי",       "#0891b2"),
    "AI_NEWS":        ("🧠", "AI",              "#db2777"),
    "CYBERSECURITY":  ("🔐", "סייבר",           "#7c3aed"),
    "DEFENSE_TECH":   ("🛡️", "ביטחון טכנולוגי", "#b91c1c"),
    "ECONOMY":        ("📈", "כלכלה ישראלית",   "#0284c7"),
    "EMPLOYMENT":     ("👔", "שוק העבודה",      "#0d9488"),
    "DRAMA":          ("💥", "דרמה",            "#dc2626"),
    "PERSONALITY":    ("👤", "דמות",            "#ea580c"),
    "STATS":          ("📊", "נתונים",          "#65a30d"),
    "SKIP":           ("⏭", "פחות רלוונטי",    "#475569"),
}


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>Startup Nation - News Pipeline</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Heebo', sans-serif;
    background: #0a0e1a;
    color: #e2e8f0;
    line-height: 1.5;
    padding: 20px;
  }}
  header {{
    max-width: 1500px;
    margin: 0 auto 24px;
    padding: 28px;
    background: linear-gradient(135deg, #1e3a8a, #312e81);
    border-radius: 14px;
    border: 1px solid #4338ca;
  }}
  header h1 {{ font-size: 30px; margin-bottom: 8px; }}
  header .stats {{ color: #c7d2fe; font-size: 14px; }}
  header .stats span {{ color: #fbbf24; font-weight: 700; }}
  .filters {{
    max-width: 1500px;
    margin: 0 auto 20px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }}
  .filter-btn {{
    padding: 8px 16px;
    background: #1e293b;
    border: 1px solid #334155;
    color: #cbd5e1;
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }}
  .filter-btn:hover, .filter-btn.active {{ background: #2563eb; color: white; border-color: #2563eb; }}
  .grid {{
    max-width: 1500px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 16px;
  }}
  .card {{
    background: #1e293b;
    border: 2px solid #334155;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }}
  .card.tier-1 {{ border-color: #fbbf24; box-shadow: 0 0 30px rgba(251, 191, 36, 0.2); }}
  .card.tier-2 {{ border-color: #38bdf8; }}
  .card.tier-3 {{ border-color: #475569; opacity: 0.85; }}
  .card img {{ width: 100%; height: 180px; object-fit: cover; background: #0f172a; }}
  .no-image {{
    height: 180px;
    background: linear-gradient(135deg, #1e293b, #0f172a);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; color: #475569;
  }}
  .score-badge {{
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    color: white;
    padding: 6px 12px;
    border-radius: 8px;
    font-weight: 800;
    font-size: 18px;
    z-index: 2;
    border: 2px solid;
  }}
  .score-badge.tier-1 {{ border-color: #fbbf24; color: #fbbf24; }}
  .score-badge.tier-2 {{ border-color: #38bdf8; color: #38bdf8; }}
  .score-badge.tier-3 {{ border-color: #94a3b8; color: #94a3b8; }}
  .cat-badge {{
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: white;
    z-index: 2;
  }}
  .card-body {{ padding: 14px; flex: 1; display: flex; flex-direction: column; }}
  .source-line {{ font-size: 12px; color: #64748b; margin-bottom: 6px; }}
  .hook {{
    font-size: 17px;
    font-weight: 700;
    color: #fef3c7;
    margin-bottom: 8px;
    line-height: 1.4;
    padding: 8px 12px;
    background: rgba(251, 191, 36, 0.08);
    border-right: 3px solid #fbbf24;
    border-radius: 4px;
  }}
  .original-title {{ font-size: 13px; color: #cbd5e1; margin-bottom: 8px; }}
  .reason {{ font-size: 11px; color: #94a3b8; font-style: italic; margin-bottom: 10px; }}
  .card-footer {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid #334155;
  }}
  .date {{ font-size: 11px; color: #64748b; }}
  .card a {{ color: #38bdf8; text-decoration: none; font-size: 13px; font-weight: 600; }}
  .card a:hover {{ text-decoration: underline; }}
</style>
</head>
<body>
<header>
  <h1>🚀 Startup Nation - News Pipeline</h1>
  <div class="stats">
    <span>{total}</span> ידיעות מוצגות ·
    <span style="color:#fbbf24">{tier1}</span> טופ (≥8.5) ·
    <span style="color:#38bdf8">{tier2}</span> בינוני (6-8.4) ·
    עלות דירוג: <span>${cost}</span> ·
    עודכן: <span>{updated}</span>
  </div>
</header>

<div class="filters">
  <button class="filter-btn active" data-filter="all">הכל ({total})</button>
  {filter_buttons}
</div>

<div class="grid">
{cards}
</div>

<script>
  document.querySelectorAll('.filter-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('.card').forEach(c => {{
        c.style.display = (f === 'all' || c.dataset.cat === f) ? 'flex' : 'none';
      }});
    }});
  }});
</script>
</body>
</html>
"""


def format_date(iso):
    if not iso:
        return ""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d/%m %H:%M")
    except Exception:
        return iso[:16]


def tier_class(score):
    if score >= 8.5:
        return "tier-1"
    if score >= 6:
        return "tier-2"
    return "tier-3"


def build_card(art):
    image_html = (
        f'<img src="{escape(art["image_url"])}" alt="" onerror="this.outerHTML=\'<div class=no-image>אין תמונה</div>\'">'
        if art.get("image_url")
        else '<div class="no-image">אין תמונה</div>'
    )

    cat = art.get("category", "SKIP")
    emoji, cat_name, cat_color = CATEGORY_META.get(cat, CATEGORY_META["SKIP"])
    score = float(art.get("score", 0))
    t = tier_class(score)

    hook_text = art.get("hook") or art["title"]
    hook_html = f'<div class="hook">"{escape(hook_text)}"</div>'

    return f"""
    <div class="card {t}" data-cat="{cat}">
      <div class="score-badge {t}">{score:.1f}</div>
      <span class="cat-badge" style="background:{cat_color}">{emoji} {cat_name}</span>
      {image_html}
      <div class="card-body">
        <div class="source-line">📰 {escape(art["source_name"])} · {format_date(art.get("published"))}</div>
        {hook_html}
        <div class="original-title">📝 {escape(art["title"][:120])}</div>
        <div class="reason">💭 {escape((art.get("score_reason") or "")[:140])}</div>
        <div class="card-footer">
          <span class="date">{escape(art["source_id"])}</span>
          <a href="{escape(art["url"])}" target="_blank">קרא מקור ←</a>
        </div>
      </div>
    </div>
    """


def main():
    if SCORED.exists():
        data = json.loads(SCORED.read_text(encoding="utf-8"))
        articles = data["articles"]
        cost = data.get("estimated_cost_usd", 0)
    else:
        data = json.loads(LATEST.read_text(encoding="utf-8"))
        articles = [
            {**a, "score": 0, "category": "SKIP", "hook": "", "score_reason": "Not scored yet"}
            for a in data["articles"]
        ]
        cost = 0

    # Filter: drop SKIP unless score >= 4
    visible = [a for a in articles if a.get("category") != "SKIP" or float(a.get("score", 0)) >= 4]

    # Rank by score + recency bonus: today +2, yesterday +1, 2 days ago +0.5
    now = datetime.now(timezone.utc)
    def rank_key(a):
        score = float(a.get("score", 0))
        pub = a.get("published") or ""
        try:
            dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            age_days = (now - dt).total_seconds() / 86400
            bonus = 2.0 if age_days < 1 else (1.0 if age_days < 2 else (0.5 if age_days < 3 else 0))
        except Exception:
            bonus = 0
        return -(score + bonus)

    visible = sorted(visible, key=rank_key)[:50]

    by_cat = {}
    for a in visible:
        c = a.get("category", "SKIP")
        by_cat[c] = by_cat.get(c, 0) + 1

    filter_buttons = "\n  ".join(
        f'<button class="filter-btn" data-filter="{c}">'
        f'{CATEGORY_META.get(c, CATEGORY_META["SKIP"])[0]} '
        f'{CATEGORY_META.get(c, CATEGORY_META["SKIP"])[1]} ({n})</button>'
        for c, n in sorted(by_cat.items(), key=lambda x: -x[1])
    )

    cards = "\n".join(build_card(a) for a in visible)

    tier1 = sum(1 for a in visible if float(a.get("score", 0)) >= 8.5)
    tier2 = sum(1 for a in visible if 6 <= float(a.get("score", 0)) < 8.5)

    html = HTML_TEMPLATE.format(
        total=len(visible),
        tier1=tier1,
        tier2=tier2,
        cost=f"{cost:.3f}",
        updated=format_date(data.get("generated_at")),
        filter_buttons=filter_buttons,
        cards=cards,
    )
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"✓ Built {OUTPUT} ({len(visible)} articles shown, {tier1} top tier)")
    print(f"  Open: file://{OUTPUT.absolute()}")


if __name__ == "__main__":
    main()
