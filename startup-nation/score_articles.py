"""Startup Nation - Article Scorer.

Reads output/articles_latest.json and uses Claude to score each article
for Israeli tech/startup audience engagement potential.

Output: output/articles_scored.json (sorted by score, highest first)

Run: python3 score_articles.py
"""

import json
import os
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
import anthropic

SCRIPT_DIR = Path(__file__).parent
INPUT = SCRIPT_DIR / "output" / "articles_latest.json"
OUTPUT = SCRIPT_DIR / "output" / "articles_scored.json"
LOG_DIR = SCRIPT_DIR / "logs"

# Haiku is fast + cheap for bulk scoring
MODEL = "claude-haiku-4-5-20251001"
BATCH_SIZE = 20

SYSTEM_PROMPT = """You are a senior editor for "Startup Nation" - an Instagram page about the Israeli tech/startup ecosystem, defense-tech, and cyber/intelligence achievements.

Your audience: Israeli tech workers, founders, investors, IDF veterans turned entrepreneurs, people proud of Israel's tech and security capabilities (ages 25-40).

SCORING RULES (additive):
- Israeli company or founder featured: +3
- Big money story (>$50M funding/exit/IPO): +3
- Israeli cyber/intelligence/defense success or breakthrough: +3
- Famous person (Musk, Altman, well-known Israeli CEO, IDF commander): +2
- Unique angle, dramatic, surprising twist: +2
- Affects Israeli tech employees directly (layoffs, hiring, salaries, relocation): +2
- Israeli military tech that became a global product: +2
- Time-sensitive / breaking news: +1
- Industry-shaping AI/biotech/defense tech: +1
- Israeli economic indicator that affects tech (shekel/dollar rate, inflation, BoI rate, tech sector budget): +1
- Trend or shift relevant to Israeli startups (regulation, market moves): +1

PENALTIES (subtract):
- Pure consumer gadget review: -2
- Heavy partisan political commentary (Netanyahu/Lapid/coalition opinions): -3
- Generic global story with NO connection to Israeli tech ecosystem: -2
- Religious or social-issue politics: -3

CATEGORIES (pick ONE):
- ISRAELI_PRIDE: Israeli company exit/funding/IPO/major win/recognition
- FUNDING: Funding round (any geography, >$10M)
- LAUNCH: New product/company launch
- GLOBAL_TECH: Major global tech move (Apple/Google/MS) that affects ecosystem
- AI_NEWS: AI-specific breakthrough or news
- CYBERSECURITY: Israeli cyber achievement, Unit 8200 spinoff, cyber intelligence win, defense cyber operation
- DEFENSE_TECH: Israeli military technology, IDF innovation, defense company breakthrough, drone/missile/laser tech
- ECONOMY: Israeli macroeconomy relevant to tech - shekel/dollar, BoI rate, inflation, tech budget, GDP from tech
- EMPLOYMENT: Tech labor market - layoffs, hiring waves, salaries, relocation, talent shortage
- DRAMA: Crash, lawsuit, controversy, failure
- PERSONALITY: Person-centric story (interview, profile, Israeli founder abroad)
- STATS: Numbers/data/research about the ecosystem
- SKIP: Not relevant (partisan politics, fluff, generic non-tech news)

OUTPUT FORMAT: Return a JSON array. One object per article, in the SAME ORDER as input.
Each object MUST have: {"id":"...", "score":N, "category":"...", "hook":"...", "reason":"..."}
- score: number 1.0 to 10.0
- hook: short Hebrew headline (5-12 words) suitable for Instagram slide
- reason: 1 sentence why this score (in Hebrew or English)

CRITICAL: Return ONLY the JSON array, no markdown, no explanation."""


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    LOG_DIR.mkdir(exist_ok=True)
    with open(LOG_DIR / f"score_{datetime.now():%Y%m%d}.log", "a", encoding="utf-8") as f:
        f.write(line + "\n")


def build_user_message(articles_batch):
    items = []
    for a in articles_batch:
        items.append({
            "id": a["id"],
            "title": a["title"],
            "description": (a.get("description") or "")[:300],
            "source": a["source_name"],
            "lang": a["source_lang"],
        })
    return f"Score these {len(items)} articles:\n\n{json.dumps(items, ensure_ascii=False, indent=1)}"


def score_batch(client, articles_batch):
    """Send one batch to Claude, return scored list."""
    resp = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_message(articles_batch)}],
    )
    raw = resp.content[0].text.strip()
    # Strip optional code fences just in case
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1].lstrip("json").strip()
        raw = raw.rsplit("```", 1)[0].strip()
    scores = json.loads(raw)
    return scores, resp.usage


def merge_scores(articles, all_scores):
    """Merge score data into article objects."""
    score_by_id = {s["id"]: s for s in all_scores}
    merged = []
    for a in articles:
        s = score_by_id.get(a["id"])
        if s:
            a_copy = dict(a)
            a_copy["score"] = float(s.get("score", 0))
            a_copy["category"] = s.get("category", "SKIP")
            a_copy["hook"] = s.get("hook", "")
            a_copy["score_reason"] = s.get("reason", "")
            merged.append(a_copy)
        else:
            a_copy = dict(a)
            a_copy["score"] = 0
            a_copy["category"] = "SKIP"
            a_copy["hook"] = ""
            a_copy["score_reason"] = "Not scored"
            merged.append(a_copy)
    return merged


def main():
    load_dotenv(SCRIPT_DIR / ".env")
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or api_key.startswith("sk-ant-api03-..."):
        log("❌ ANTHROPIC_API_KEY not set in .env")
        return

    client = anthropic.Anthropic(api_key=api_key)

    # Prefer archive (all historical articles) over latest-only
    archive_file = SCRIPT_DIR / "output" / "articles_archive.json"
    source_file = archive_file if archive_file.exists() else INPUT
    data = json.loads(source_file.read_text(encoding="utf-8"))
    articles = data["articles"]
    log(f"Loaded {len(articles)} articles from {'archive' if source_file == archive_file else 'latest'}")

    # Load already-scored articles to skip re-scoring
    already_scored = {}
    if OUTPUT.exists():
        prev = json.loads(OUTPUT.read_text(encoding="utf-8"))
        already_scored = {a["id"]: a for a in prev.get("articles", []) if "score" in a}
        log(f"Skipping {len(already_scored)} already-scored articles")

    to_score = [a for a in articles if a["id"] not in already_scored]
    log(f"New articles to score: {len(to_score)}")

    batches = [to_score[i:i + BATCH_SIZE] for i in range(0, len(to_score), BATCH_SIZE)]
    log(f"Splitting into {len(batches)} batches of up to {BATCH_SIZE}")

    all_scores = []
    total_input = total_output = 0
    for i, batch in enumerate(batches, 1):
        log(f"  Batch {i}/{len(batches)} ({len(batch)} articles)...")
        try:
            scores, usage = score_batch(client, batch)
            all_scores.extend(scores)
            total_input += usage.input_tokens
            total_output += usage.output_tokens
            log(f"    ✓ {len(scores)} scored. Tokens: {usage.input_tokens}+{usage.output_tokens}")
        except Exception as e:
            log(f"    ✗ Batch {i} failed: {type(e).__name__}: {e}")

    new_merged = merge_scores(to_score, all_scores)
    # Combine with previously scored
    all_articles = list(already_scored.values()) + new_merged
    merged = sorted(all_articles, key=lambda a: (-a.get("score", 0), a.get("published") or ""))

    # Haiku 4.5 pricing: $1/Mtok input, $5/Mtok output (approx)
    estimated_cost = (total_input / 1_000_000) * 1.0 + (total_output / 1_000_000) * 5.0
    log(f"Total tokens: {total_input} in, {total_output} out")
    log(f"Estimated cost: ${estimated_cost:.4f}")

    OUTPUT.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "total_articles": len(merged),
        "high_scoring": sum(1 for a in merged if a["score"] >= 7),
        "tokens": {"input": total_input, "output": total_output},
        "estimated_cost_usd": round(estimated_cost, 4),
        "articles": merged,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"✓ Wrote {OUTPUT}")

    # Print top 10 summary
    log("\n=== Top 10 highest-scoring articles ===")
    for i, a in enumerate(merged[:10], 1):
        log(f"  {i}. [{a['score']:.1f}] {a['category']:15s} {a['title'][:70]}")


if __name__ == "__main__":
    main()
