import os
from dotenv import load_dotenv
from aliexpress_api import AliexpressApi, models

load_dotenv()

api = AliexpressApi(
    os.environ["ALIEXPRESS_APP_KEY"],
    os.environ["ALIEXPRESS_APP_SECRET"],
    models.Language.EN,
    models.Currency.USD,
    os.environ["ALIEXPRESS_TRACKING_ID"],
)

response = api.get_products(keywords="ski goggles", page_size=5)
print(f"total_record_count: {response.total_record_count}")
for p in response.products:
    print("---")
    print(vars(p))
