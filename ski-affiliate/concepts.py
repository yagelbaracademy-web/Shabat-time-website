import re

# Concept-level product tags, independent of keyword/family. Used to cap how
# often the same *kind* of product (regardless of exact wording, brand, or
# which family/keyword found it) can appear within a rolling window - e.g.
# "goggles" and "gloves" have near-endless supply on AliExpress and would
# otherwise resurface every run even though no two exact listings are
# identical.
#
# Ski-only catalog (2026-09-14): patterns rewritten for the ski/snowboard
# product set in config.py. Order matters - the first matching pattern wins,
# so more specific patterns (e.g. "backpack/bag") are listed before broader
# ones that could also match part of the same title (e.g. "boots").
CONCEPT_PATTERNS = {
    "goggles/sunglasses": r"goggles|sunglass|eyewear",
    "helmet": r"helmet",
    "backpack/bag": r"backpack|bagpack|rucksack|\bbag\b",
    "boots": r"\bboots?\b",
    "bindings": r"binding",
    "poles": r"\bpoles?\b",
    "wax/tuning kit": r"wax kit|tuning kit|edge tool",
    "jacket": r"jacket",
    "pants/bibs": r"\bpants\b|\bbib\b|salopette",
    "base layer/thermal underwear": r"base layer|thermal underwear|thermal.*legging",
    "socks": r"\bsocks?\b",
    "gloves/mittens": r"glove|mitten",
    "balaclava/neck cover": r"balaclava|neck gaiter|neck warmer|face mask",
    "hand/foot warmers": r"hand warmer|foot warmer",
    "ice grip/traction spikes": r"ice grip|traction spike|crampon",
}


def classify_concept(title):
    title_lower = title.lower()
    for name, pattern in CONCEPT_PATTERNS.items():
        if re.search(pattern, title_lower):
            return name
    return None
