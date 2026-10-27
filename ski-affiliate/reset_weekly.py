"""Weekly reset: marks the fixed core products (sheet rows 2-12) as not
posted again, so the Make scenario re-sends them to the WhatsApp group
every week alongside the newly collected products.

Row 3 (helmet) is skipped on purpose: helmets are not recommended in the
group (2026-10-27)."""

from sheets import NOT_POSTED_STATUS, get_worksheet

RESET_RANGES = ["D2", "D4:D12"]


def main():
    ws = get_worksheet()
    ws.batch_update([
        {"range": "D2", "values": [[NOT_POSTED_STATUS]]},
        {"range": "D4:D12", "values": [[NOT_POSTED_STATUS]] * 9},
    ])
    print(f"Reset {', '.join(RESET_RANGES)} to '{NOT_POSTED_STATUS}'")


if __name__ == "__main__":
    main()
