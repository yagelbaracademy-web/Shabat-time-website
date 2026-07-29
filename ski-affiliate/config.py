MIN_ORDERS = 400
MIN_SALE_PRICE_USD = 5

# Each family: a group of related keywords with a total cap on how many
# products from that family can enter the sheet in a single run (even if
# more qualify). Capped items aren't blacklisted - they're just not marked
# as "seen", so they're eligible again in a future run once there's room.
CATEGORIES = [
    {
        "name": "ski_snowboard_direct",
        "category_id": "200003543",  # Skiing & Snowboarding
        "max_per_keyword": 4,
        "family_cap": 8,
        "keywords": [
            "ski goggles",
            "snowboard gloves",
            "ski gloves heated",
            "thermal base layer skiing",
            "snowboard wax kit",
            "ski socks thermal",
            "balaclava ski mask",
            "ski jacket waterproof",
            "ski pants waterproof",
            "snowboard pants",
            "ski neck gaiter",
            "ski poles",
            "mountain gloves waterproof",
        ],
    },
    {
        "name": "clothing_extra",
        "category_id": None,
        "max_per_keyword": 2,
        "family_cap": 3,
        "keywords": [
            "winter beanie hat",
            "thermal underwear set",
            "thermal arm warmers",
            "thermal leg warmers",
        ],
    },
    {
        "name": "footwear",
        "category_id": None,
        "max_per_keyword": 2,
        "family_cap": 3,
        "keywords": [
            "waterproof snow boots",
            "waterproof hiking walking shoes",
            "anti slip ice grip shoe spikes",
        ],
    },
    {
        "name": "gadgets",
        "category_id": None,
        "max_per_keyword": 2,
        "family_cap": 4,
        "keywords": [
            "portable power bank",
            "led headlamp flashlight",
            "phone mount bike helmet",
            "outdoor sports watch",
            "wireless earbuds sport",
            "mini portable bluetooth speaker",
        ],
    },
    {
        "name": "hydration_warmth",
        "category_id": None,
        "max_per_keyword": 2,
        "family_cap": 3,
        "keywords": [
            "reusable thermal cup travel",
            "sports water bottle",
            "hand warmers reusable",
            "heated insoles foot warmers",
        ],
    },
    {
        "name": "safety_convenience",
        "category_id": None,
        "max_per_keyword": 2,
        "family_cap": 2,
        "keywords": [
            "emergency whistle",
            "car ice scraper",
            "touchscreen gloves winter",
        ],
    },
    {
        "name": "summer_travel",
        "category_id": None,
        "max_per_keyword": 2,
        "family_cap": 4,
        "keywords": [
            "collapsible water bottle travel",
            "portable neck fan",
            "cooling towel sport",
            "polarized sunglasses outdoor",
            "quick dry travel towel",
            "waterproof phone pouch beach",
        ],
    },
    {
        "name": "travel_indirect",
        "category_id": "201296102",  # Travel Accessories
        "max_per_keyword": 2,
        "family_cap": 2,
        "keywords": [
            "luggage tag",
            "travel neck pillow",
            "universal travel adapter",
            "toiletry bag travel",
            "passport holder travel",
        ],
    },
    {
        "name": "travel_bags",
        "category_id": "202236005",  # Backpack
        "max_per_keyword": 2,
        "family_cap": 2,
        "keywords": [
            "ski backpack",
            "waterproof travel backpack",
            "ski boot bag",
        ],
    },
]
