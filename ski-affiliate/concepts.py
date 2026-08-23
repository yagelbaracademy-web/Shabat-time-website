import re

# Concept-level product tags, independent of keyword/family. Used to cap how
# often the same *kind* of product (regardless of exact wording, brand, or
# which family/keyword found it) can appear within a rolling window - a
# generic "backpack" and "smart AirTag-style tracker" keep resurfacing every
# run because AliExpress has near-endless supply of each, even though no two
# exact listings are identical.
CONCEPT_PATTERNS = {
    "backpack/bag": r"backpack|bagpack|rucksack",
    "headlamp/flashlight": r"headlamp|flashlight|head lamp|head flashlight",
    "earbuds/headphones/speaker": r"earbuds|earphone|headphone|bluetooth.*speaker|wireless.*speaker",
    "power bank/charger": r"power bank|powerbank|portable charger",
    "sunglasses/goggles": r"sunglass|ski goggles|snow goggles|snowboard goggles|eyewear",
    "smart tag/tracker": r"smart tag|tracker|find my|smarttrack",
    "car phone mount/holder": r"car.*phone.*(mount|holder)|phone.*(mount|holder).*car",
    "screwdriver": r"screwdriver",
    "neck fan": r"neck fan|neck.*hanging fan|hanging.*neck.*fan|waist fan",
    "dry bag/waterproof storage": r"dry bag|dry sack|waterproof.*storage",
    "water bottle": r"water bottle|water container|water bladder",
    "travel pillow": r"inflatable.*pillow|travel pillow|neck pillow",
    "gloves": r"gloves",
    "projector": r"projector",
    "lock": r"\block\b",
}


def classify_concept(title):
    title_lower = title.lower()
    for name, pattern in CONCEPT_PATTERNS.items():
        if re.search(pattern, title_lower):
            return name
    return None
