from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials

SPREADSHEET_ID = "18oyT-_f7UqDWClZVCAszogX13Vy_mDH71s84sZgAjF4"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SERVICE_ACCOUNT_PATH = Path(__file__).parent / "service_account.json"

NOT_POSTED_STATUS = "no"


def get_worksheet():
    creds = Credentials.from_service_account_file(str(SERVICE_ACCOUNT_PATH), scopes=SCOPES)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(SPREADSHEET_ID)
    return sh.get_worksheet(0)


def record_to_row(record):
    discount = record.get("discount") or ""
    if discount in ("0%", ""):
        discount = ""
    return [
        record["title"],
        record["link"],
        record["image"],
        NOT_POSTED_STATUS,
        str(record["product_id"]),
        record["date_added"],
        discount,
        "",  # משלוח - not available from the API
    ]


def append_records(records):
    ws = get_worksheet()
    rows = [record_to_row(r) for r in records]
    ws.append_rows(rows, value_input_option="USER_ENTERED")
    return len(rows)


def count_unposted():
    ws = get_worksheet()
    status_col = ws.col_values(4)[1:]  # skip header
    return sum(1 for s in status_col if s.strip() == NOT_POSTED_STATUS)
