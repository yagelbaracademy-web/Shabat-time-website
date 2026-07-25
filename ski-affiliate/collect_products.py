import argparse
import json
import os
import random
import time
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from aliexpress_api import AliexpressApi, models

from config import CATEGORIES, MIN_ORDERS, MIN_SALE_PRICE_USD
from sheets import append_records, count_unposted

load_dotenv()

STATE_PATH = Path(__file__).parent / "state.json"
BUFFER_THRESHOLD = 5


def load_state():
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text())
    return {"seen_product_ids": []}


def save_state(state):
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2))


def build_api():
    return AliexpressApi(
        os.environ["ALIEXPRESS_APP_KEY"],
        os.environ["ALIEXPRESS_APP_SECRET"],
        models.Language.HE,
        models.Currency.USD,
        os.environ["ALIEXPRESS_TRACKING_ID"],
    )


def product_to_record(p, short_link, group_name):
    return {
        "product_id": p.product_id,
        "title": p.product_title,
        "link": short_link,
        "image": p.product_main_image_url,
        "discount": getattr(p, "discount", None),
        "orders": getattr(p, "lastest_volume", 0),
        "category_group": group_name,
        "date_added": date.today().strftime("%d/%m/%Y"),
    }


def collect(dry_run=False):
    api = build_api()
    state = load_state()
    seen = set(str(x) for x in state["seen_product_ids"])
    new_products = []

    for cat in CATEGORIES:
        family_pool = []  # candidates for this family across all its keywords

        for kw in cat["keywords"]:
            print(f"searching: [{cat['name']}] {kw}")
            try:
                response = api.get_products(
                    keywords=kw,
                    category_ids=cat["category_id"],
                    sort=models.SortBy.LAST_VOLUME_DESC,
                    page_size=50,
                    min_sale_price=MIN_SALE_PRICE_USD * 100,
                )
            except Exception as e:
                print(f"  error: {e}")
                continue

            products = getattr(response, "products", None) or []
            qualifying = [
                p for p in products
                if (getattr(p, "lastest_volume", 0) or 0) >= MIN_ORDERS
                and str(p.product_id) not in seen
                and p.product_id not in {x.product_id for x in family_pool}
            ]
            qualifying = qualifying[: cat.get("max_per_keyword", 5)]
            family_pool.extend(qualifying)

            time.sleep(1)

        # keep only the top N (by orders) for this family this run; the rest
        # stay eligible for a future run instead of being discarded forever
        family_pool.sort(key=lambda p: getattr(p, "lastest_volume", 0) or 0, reverse=True)
        kept = family_pool[: cat.get("family_cap", 5)]

        if kept:
            try:
                urls = [p.product_detail_url for p in kept]
                links = api.get_affiliate_links(urls)
                link_map = {l.source_value: l.promotion_link for l in links}
            except Exception as e:
                print(f"  link generation error: {e}")
                link_map = {}

            for p in kept:
                short_link = link_map.get(p.product_detail_url, p.promotion_link)
                seen.add(str(p.product_id))
                new_products.append(product_to_record(p, short_link, cat["name"]))

    print(f"\nnew qualifying products found: {len(new_products)}")
    random.shuffle(new_products)

    if not dry_run and new_products:
        n = append_records(new_products)
        print(f"appended {n} rows to the sheet")

        state["seen_product_ids"] = sorted(seen)
        save_state(state)

        out_path = Path(__file__).parent / f"candidates_{date.today().isoformat()}.json"
        out_path.write_text(json.dumps(new_products, ensure_ascii=False, indent=2))
        print(f"log saved to {out_path}")

    return new_products


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="preview only: don't write to sheet or update state.json")
    parser.add_argument("--force", action="store_true", help="collect even if the unposted buffer is above the threshold")
    args = parser.parse_args()

    if not args.force:
        unposted = count_unposted()
        print(f"unposted products currently in the sheet: {unposted}")
        if unposted > BUFFER_THRESHOLD:
            print(f"buffer above {BUFFER_THRESHOLD}, skipping collection")
            raise SystemExit(0)

    results = collect(dry_run=args.dry_run)
    for r in results:
        print(f"- {r['orders']} orders | {r['discount']} off | {r['title'][:70]}")
