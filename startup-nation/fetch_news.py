"""Startup Nation - RSS Fetcher.

Fetches latest articles from all configured RSS feeds, dedupes them,
and saves to output/articles_latest.json.

Run: python3 fetch_news.py
"""

import json
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import feedparser
import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).parent
FEEDS_FILE = SCRIPT_DIR / "sources" / "feeds.json"
OUTPUT_DIR = SCRIPT_DIR / "output"
LOG_DIR = SCRIPT_DIR / "logs"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 StartupNation/1.0"
FETCH_TIMEOUT = 15
MAX_ITEMS_PER_FEED = 15


def log(msg, level="INFO"):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {level:5s} {msg}"
    print(line)
    LOG_DIR.mkdir(exist_ok=True)
    with open(LOG_DIR / f"fetch_{datetime.now():%Y%m%d}.log", "a", encoding="utf-8") as f:
        f.write(line + "\n")


def clean_text(html_or_text):
    """Strip HTML, normalize whitespace."""
    if not html_or_text:
        return ""
    soup = BeautifulSoup(html_or_text, "html.parser")
    text = soup.get_text(separator=" ")
    return re.sub(r"\s+", " ", text).strip()


def extract_image(entry, description_html):
    """Find the first usable image URL in the entry."""
    if hasattr(entry, "media_content") and entry.media_content:
        for m in entry.media_content:
            if m.get("url"):
                return m["url"]
    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        return entry.media_thumbnail[0].get("url")
    if hasattr(entry, "enclosures"):
        for enc in entry.enclosures:
            if enc.get("type", "").startswith("image"):
                return enc.get("href")
    if description_html:
        soup = BeautifulSoup(description_html, "html.parser")
        img = soup.find("img")
        if img and img.get("src"):
            return img["src"]
    return None


def article_hash(title, url):
    """Stable id for an article. Used for dedup across runs."""
    base = f"{(title or '').strip()}|{(url or '').strip()}"
    return hashlib.md5(base.encode("utf-8")).hexdigest()[:16]


def parse_entry(entry, feed_meta):
    title = clean_text(entry.get("title", ""))
    description_html = entry.get("summary", entry.get("description", ""))
    description = clean_text(description_html)
    link = entry.get("link", "")

    published = entry.get("published_parsed") or entry.get("updated_parsed")
    if published:
        published_iso = datetime(*published[:6], tzinfo=timezone.utc).isoformat()
    else:
        published_iso = None

    return {
        "id": article_hash(title, link),
        "title": title,
        "description": description[:500] if description else "",
        "url": link,
        "published": published_iso,
        "image_url": extract_image(entry, description_html),
        "source_id": feed_meta["id"],
        "source_name": feed_meta["name"],
        "source_lang": feed_meta["lang"],
        "source_priority": feed_meta["priority"],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def fetch_feed(feed_meta):
    """Fetch a single feed and return parsed articles. Returns empty list on failure."""
    url = feed_meta["url"]
    name = feed_meta["name"]
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=FETCH_TIMEOUT)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
        articles = [parse_entry(e, feed_meta) for e in feed.entries[:MAX_ITEMS_PER_FEED]]
        log(f"✓ {name}: {len(articles)} articles")
        return articles
    except Exception as e:
        log(f"✗ {name}: {type(e).__name__}: {e}", level="ERROR")
        return []


def fetch_all(feeds, max_workers=8):
    all_articles = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fetch_feed, feed): feed for feed in feeds}
        for fut in as_completed(futures):
            all_articles.extend(fut.result())
    return all_articles


def dedupe(articles):
    """Remove duplicates by hash. Keep highest-priority source on collision."""
    priority_rank = {"high": 0, "medium": 1, "low": 2}
    seen = {}
    for art in articles:
        key = art["id"]
        if key not in seen or priority_rank.get(art["source_priority"], 9) < priority_rank.get(seen[key]["source_priority"], 9):
            seen[key] = art
    return list(seen.values())


def main():
    log(f"Starting fetch run")
    feeds_config = json.loads(FEEDS_FILE.read_text(encoding="utf-8"))
    feeds = feeds_config["feeds"]
    log(f"Loaded {len(feeds)} feeds")

    raw_articles = fetch_all(feeds)
    log(f"Fetched {len(raw_articles)} raw articles")

    unique = dedupe(raw_articles)
    dupes_removed = len(raw_articles) - len(unique)
    log(f"After dedup: {len(unique)} articles ({dupes_removed} duplicates removed)")

    unique.sort(key=lambda a: a.get("published") or "", reverse=True)

    OUTPUT_DIR.mkdir(exist_ok=True)

    # Merge into rolling archive (keeps all articles, no duplicates)
    archive_file = OUTPUT_DIR / "articles_archive.json"
    if archive_file.exists():
        existing = json.loads(archive_file.read_text(encoding="utf-8")).get("articles", [])
        existing_ids = {a["id"] for a in existing}
        new_articles = [a for a in unique if a["id"] not in existing_ids]
        merged = unique + [a for a in existing if a["id"] not in {x["id"] for x in unique}]
        merged.sort(key=lambda a: a.get("published") or "", reverse=True)
        log(f"Archive: +{len(new_articles)} new, {len(merged)} total")
    else:
        merged = unique
        log(f"Archive: created with {len(merged)} articles")
    archive_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_articles": len(merged),
        "articles": merged,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    output_file = OUTPUT_DIR / "articles_latest.json"
    output_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_articles": len(unique),
        "sources_count": len(feeds),
        "articles": unique,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"Wrote {output_file}")

    by_source = {}
    for art in unique:
        by_source[art["source_name"]] = by_source.get(art["source_name"], 0) + 1
    log("Per-source counts: " + ", ".join(f"{n}={c}" for n, c in sorted(by_source.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
