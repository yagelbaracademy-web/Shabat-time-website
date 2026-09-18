MIN_ORDERS = 400
MIN_SALE_PRICE_USD = 5
MAX_PER_KEYWORD = 1  # at most 1 product per keyword per run, so variety comes
                      # from different keywords, not depth within one keyword

# Rolling-window concept cap: across any WINDOW_SIZE consecutively collected
# products, the same product *concept* (goggles, gloves, jacket... see
# concepts.py) can't appear more than MAX_PER_CONCEPT_IN_WINDOW times - this
# is what actually stops "another pair of goggles" / "another glove listing"
# from showing up every single run, since per-run caps alone don't prevent
# that over time.
WINDOW_SIZE = 30
MAX_PER_CONCEPT_IN_WINDOW = 3

# Each family: a group of related keywords with a total cap on how many
# products from that family can enter the sheet in a single run (even if
# more qualify). Capped items aren't blacklisted - they're just not marked
# as "seen", so they're eligible again in a future run once there's room.
#
# Ski season pivot (2026-09-14): the channel now focuses only on
# ski/snowboard-related products, ahead of the upcoming season. Off-topic
# categories (general tech gadgets, summer travel, generic luggage) were
# removed - everything below should plausibly be useful for a ski/snowboard
# trip.
CATEGORIES = [
    {
        "name": "ski_snowboard_gear",
        "category_id": "200003543",  # Skiing & Snowboarding
        "family_cap": 6,
        "keywords": [
            "ski goggles",
            "snowboard goggles",
            "ski helmet",
            "snowboard bindings",
            "ski poles",
            "snowboard wax kit",
            "ski boot bag",
            "snowboard bag",
            "ski backpack",
        ],
    },
    {
        "name": "ski_apparel",
        "category_id": "200003543",  # Skiing & Snowboarding
        "family_cap": 6,
        "keywords": [
            "ski jacket waterproof",
            "ski pants waterproof",
            "thermal base layer skiing",
            "ski socks thermal",
            "snowboard gloves",
            "ski gloves waterproof",
            "heated gloves winter",
            "touchscreen gloves winter",
            "balaclava ski mask",
            "neck gaiter fleece",
            "ski mittens",
        ],
    },
    {
        "name": "ski_accessories",
        "category_id": None,
        "family_cap": 3,
        "keywords": [
            "hand warmers reusable",
            "heated socks",
            "anti slip ice grip shoe spikes",
            "ski goggles anti fog",
            "snow boots waterproof",
        ],
    },
]
