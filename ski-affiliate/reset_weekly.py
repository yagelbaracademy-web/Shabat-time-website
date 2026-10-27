"""Weekly reset: marks the fixed core products (sheet rows 2-12) as not
posted again, so the Make scenario re-sends them to the WhatsApp group
every week alongside the newly collected products."""

from sheets import NOT_POSTED_STATUS, get_worksheet

RESET_RANGE = "D2:D12"
ROW_COUNT = 11


def main():
    ws = get_worksheet()
    ws.update(range_name=RESET_RANGE, values=[[NOT_POSTED_STATUS]] * ROW_COUNT)
    print(f"Reset {RESET_RANGE} to '{NOT_POSTED_STATUS}'")


if __name__ == "__main__":
    main()
