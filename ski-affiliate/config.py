MIN_ORDERS = 400
MIN_SALE_PRICE_USD = 5
MAX_PER_KEYWORD = 1  # at most 1 product per keyword per run, so variety comes
                      # from different keywords, not depth within one keyword

# Rolling-window concept cap: across any WINDOW_SIZE consecutively collected
# products, the same product *concept* (backpack, headlamp, earbuds..., see
# concepts.py) can't appear more than MAX_PER_CONCEPT_IN_WINDOW times - this
# is what actually stops "another bag" / "another AirTag clone" from showing
# up every single run, since per-run caps alone don't prevent that over time.
WINDOW_SIZE = 30
MAX_PER_CONCEPT_IN_WINDOW = 3

# Each family: a group of related keywords with a total cap on how many
# products from that family can enter the sheet in a single run (even if
# more qualify). Capped items aren't blacklisted - they're just not marked
# as "seen", so they're eligible again in a future run once there's room.
#
# Summer weighting: ski season is off-peak right now, so tech_gadgets and
# summer_travel carry most of the weight; ski_snowboard_direct stays small
# but present (evergreen gear, keeps the channel's core identity).
CATEGORIES = [
    {
        "name": "ski_snowboard_direct",
        "category_id": "200003543",  # Skiing & Snowboarding
        "family_cap": 4,
        "keywords": [
            "ski goggles",
            "snowboard gloves",
            "thermal base layer skiing",
            "snowboard wax kit",
            "balaclava ski mask",
            "ski jacket waterproof",
            "ski poles",
            "hand warmers reusable",
        ],
    },
    {
        "name": "footwear",
        "category_id": None,
        "family_cap": 2,
        "keywords": [
            "waterproof hiking walking shoes",
            "anti slip ice grip shoe spikes",
        ],
    },
    {
        "name": "tech_gadgets",
        "category_id": None,
        "family_cap": 8,
        "keywords": [
            "portable power bank",
            "wireless earbuds sport",
            "mini portable bluetooth speaker",
            "smart luggage tracker tag",
            "waterproof action camera",
            "foldable travel keyboard",
            "solar phone charger",
            "digital luggage lock",
            "portable espresso maker travel",
            "mini portable projector",
            "smart fitness ring",
            "led headlamp flashlight",
            "precision screwdriver tool kit",
        ],
    },
    {
        "name": "summer_travel",
        "category_id": None,
        "family_cap": 6,
        "keywords": [
            "collapsible water bottle travel",
            "portable neck fan",
            "cooling towel sport",
            "polarized sunglasses outdoor",
            "sport shield sunglasses",
            "inflatable travel neck pillow",
            "waterproof dry bag beach",
            "foldable travel duffel bag",
        ],
    },
    {
        "name": "safety_convenience",
        "category_id": None,
        "family_cap": 2,
        "keywords": [
            "touchscreen gloves winter",
            "car phone holder mount",
        ],
    },
    {
        "name": "travel_indirect",
        "category_id": "201296102",  # Travel Accessories
        "family_cap": 2,
        "keywords": [
            "luggage tag",
            "travel neck pillow",
            "universal travel adapter",
            "toiletry bag travel",
            "travel bottle dispenser set",
        ],
    },
    {
        "name": "travel_bags",
        "category_id": "202236005",  # Backpack
        "family_cap": 2,
        "keywords": [
            "ski backpack",
            "waterproof travel backpack",
            "ski boot bag",
        ],
    },
]
