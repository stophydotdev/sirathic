import json
import os

from playwright.sync_api import sync_playwright


endpoint = os.environ.get("CAMOUFOX_WS_ENDPOINT", "")
if not endpoint:
    raise SystemExit("CAMOUFOX_WS_ENDPOINT is required")

with sync_playwright() as playwright:
    browser = playwright.firefox.connect(endpoint)
    page = browser.new_page()
    page.goto("https://example.com", wait_until="domcontentloaded")
    result = {
        "title": page.title(),
        "url": page.url,
        "heading": page.locator("h1").inner_text(),
    }
    page.close()
    browser.close()

print(json.dumps(result, sort_keys=True))
