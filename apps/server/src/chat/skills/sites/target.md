# Site guide: Target

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

Jobs in this file: Target.com find a product; Target.com store pickup and fulfillment.

## Target.com find a product

### When to use

The user names a product ("AirPods Pro 2", "tide pods", "lego star wars millennium falcon") and wants Target's top match with title, brand, price, original price, rating, TCIN, canonical product URL, and image. You need only the free text query. The result also says whether Target spell corrected the query or returned filler because nothing matched. Read only. Pickup or stock at a store for a known TCIN is the fulfillment section below.

### Fastest path

Target's search page is a shell over a public JSON aggregation at `redsky.target.com`. The key is a static public token from Target's JS bundles. fetch_url returns page text, not JSON, so call it with fetch inside browser_run_code from a page on `https://www.target.com/`. The call is unreliable, and usually returns HTTP 435 (PerimeterX). Try it once and fall back to the search page in your browser.

```
GET https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2
    ?key=ff457966e64d5e877fdbad070f276d18ecec4a01
    &channel=WEB
    &keyword=<URL-encoded query>
    &page=%2Fs%2F<URL-encoded query>
    &visitor_id=<any non-empty string, e.g. "skill-runner">
    &pricing_store_id=2885
    &default_purchasability_filter=true
    &count=24
    &offset=0
    &platform=desktop
```

The server returns HTTP 400 with no body if `key`, `channel`, `keyword`, `page`, `visitor_id`, or `pricing_store_id` is missing. `page` only has to start with `/s/`. `visitor_id` accepts any non-empty string. `pricing_store_id=2885` is the default the web bundle uses and gives nationwide pricing; other store ids such as `1000` or `3991` are accepted. Optional params are `count` (default 24), `offset` (item level, so 0, 24, 48; `page_number` is a no-op), `default_purchasability_filter=true` (hides out of stock), `store_ids=<id>` (only items in stock at that store), `category=<id>`, `platform=desktop|mobile`, and `sort_by`.

| `sort_by` | Effect |
|---|---|
| `relevance` (default) | Target's relevance ranking |
| `Featured` | Featured or sponsored bias |
| `PriceLow` | Price low to high |
| `PriceHigh` | Price high to low |
| `RatingHigh` | Average rating high to low |
| `bestselling` | Best sellers first |
| `newest` | Newest first |

Worked example. `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=ff457966e64d5e877fdbad070f276d18ecec4a01&channel=WEB&keyword=AirPods+Pro+2&page=%2Fs%2FAirPods+Pro+2&visitor_id=skill-runner&pricing_store_id=2885&default_purchasability_filter=true&count=24`

### Steps

Find the user's product on Target.com. Read only, do not add to cart or check out.

From a page on https://www.target.com/, run `fetch('https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=ff457966e64d5e877fdbad070f276d18ecec4a01&channel=WEB&keyword=<url-encoded query>&page=%2Fs%2F<url-encoded query>&visitor_id=skill-runner&pricing_store_id=2885&default_purchasability_filter=true&count=24').then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))` in browser_run_code.

Check the returned status first; the lines below apply to a 200 only.

If data.search.search_response.facet_list is missing or empty, report no results and do not return a product.

If data.search.search_response.metadata.auto_corrected_keyword is set, report the correction.

From each of the first five data.search.products report tcin, item.product_description.title (decode HTML entities), item.primary_brand.name, price.formatted_current_price, price.formatted_comparison_price, ratings_and_reviews.statistics.rating.average and .count, item.enrichment.buy_url, item.enrichment.image_info.primary_image.url.

If the endpoint returns 403 with a captchaAbsoluteURL body, stop and report that URL. On HTTP 435, a body with an appId or blockScript field, or any other 4xx, do not run it again: report api_blocked for the 435 and open https://www.target.com/s?searchTerm=<url-encoded query>, click "Continue shopping" if the Health Data Consent modal shows, wait 2.5 s, and read each a[href*="/-/A-"] anchor (TCIN in the href) with the title and price text of its card.

Stop and report the URL if a captcha, sign in, 2FA, or payment wall appears.

### Read the result

Check the outcome first. Paths are under `data.search.search_response`.

- `facet_list` missing or empty means no real matches; Target pads `products[]` with about 200 unrelated bestsellers and `metadata.total_results` is padded too. Report `no_results`. Never return the first filler item as the match.
- `metadata.auto_corrected_keyword` non null means the products are for the corrected keyword ("airpoods" to "airpods"). Report the correction.

Top product is `data.search.products[0]`.

| Field | Path |
|---|---|
| tcin | `.tcin` |
| title | `.item.product_description.title`, decode `&#160;`, `&#38;`, `&#34;`, `&#8482;` |
| brand | `.item.primary_brand.name`, null for private label and grocery |
| price | `.price.formatted_current_price`, `"$249.99"` or `"See price in cart"` |
| original_price | `.price.formatted_comparison_price`, null when not on sale |
| rating | `.ratings_and_reviews.statistics.rating.average`, 0 to 5, null if unrated |
| rating_count | `.ratings_and_reviews.statistics.rating.count` |
| product_url | `.item.enrichment.buy_url` |
| image_url | `.item.enrichment.image_info.primary_image.url` |
| desirability | `.desirability_cues[].display`, for example `"Bestseller"` |

`"See price in cart"` is a real MAP restricted item; read `.price.current_retail` (numeric, sometimes populated) or open `buy_url`. Drop products whose `__typename` is not `ProductSummary` if you want to be defensive about sponsored slots. `https://www.target.com/p/<slug>/-/A-<tcin>` is canonical and `/-/A-<tcin>` alone 301s to it.

### When blocked

- `plp_search_v2` is behind PerimeterX. It answered HTTP 435 with a JSON body of the form `{"appId":"PXGWPp4wUS","blockScript":"https://captcha.px-cdn.net/...","uuid":"...","vid":""}` for most calls, with either key. Treat 435 or any `appId` or `blockScript` body as `api_blocked`: do not repeat the call, rotate the key, or add headers; the browser search page is the path.
- A 403 whose JSON body is `{"captchaRelativeURL": "/captcha?trackingId=...", "captchaAbsoluteURL": "https://redsky.target.com/captcha?trackingId=..."}` is a captcha wall, not a key problem (observed 2026-09-10 from a residential IP, for both keys and with the browser's own `visitorId` cookie). Stop and report it with the `captchaAbsoluteURL`.
- Any other 4xx from redsky most likely means the key rotated. Open the search page and look for `redsky_aggregations` in the HTML; the SSR config carries the key as `"apiKey":"<40 hex>"`. Both `9f36aeafbe60771e321a7cc95a78140772ab3e96` and `ff457966e64d5e877fdbad070f276d18ecec4a01` returned 200 on the fulfillment endpoints below while the search call returned 435, so a 435 is a block, not a key problem.
- The public site loads the HUMAN sensor `client.px-cloud.net/PXGWPp4wUS/main.min.js` as `<script id="humanSensor">`. In earlier testing a plain session was challenged within 5 to 10 requests, so your browser's address may hit the same wall on the browser path.
- The Health Data Consent modal blocks the grid until "Continue shopping" is clicked.
- If a captcha, challenge page, sign in prompt, password, 2FA code, or payment request appears, stop and report which wall and on which URL. Do not try to solve or bypass it.

## Target.com store pickup and fulfillment

### When to use

The user has a TCIN, or a product URL with `/-/A-<tcin>` in it, and wants order pickup, in-store, or shipping availability for it at a store or near a ZIP, with the available quantity where Target exposes it. You need the TCIN and either a store id or a ZIP. Read only. A product name with no TCIN is the search section above first.

### Fastest path

Two redsky calls, same public key as the search section.

1. ZIP to stores, skipped when the user gave a store id. `GET https://redsky.target.com/redsky_aggregations/v1/web/nearby_stores_v1?key=<key>&limit=5&within=50&place=<ZIP>&channel=WEB&visitor_id=skill-runner` returns `data.nearby_stores.stores[]` with `store_id`, `location_name`, `distance`, and `status`.
2. Fulfillment for one store. `GET https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_v1?key=<key>&tcin=<tcin>&store_id=<store_id>&zip=<ZIP>&channel=WEB&visitor_id=skill-runner` returns `data.product.fulfillment`; `key`, `tcin`, and `store_id` are enough. Without `store_id` it carries `shipping_options` only. One store per call, at most five.

Both answered with either key while `plp_search_v2` returned 435; keep the browser fallback in the Steps in case they are blocked too. Call them from a page on `https://www.target.com/` with fetch inside browser_run_code, not fetch_url.

A digital store id such as `3991` returns HTTP 206 and an unknown TCIN 404. Store `2885`, the search section's pricing default, is a real store in New Jersey, so never pass it as the user's store.

### Steps

Check Target store pickup for the TCIN at the user's store id or ZIP. Read only, do not add to cart, check out, or sign in.

With a ZIP and no store id, from a page on https://www.target.com/ run `fetch('https://redsky.target.com/redsky_aggregations/v1/web/nearby_stores_v1?key=ff457966e64d5e877fdbad070f276d18ecec4a01&limit=5&within=50&place=<zip>&channel=WEB&visitor_id=skill-runner').then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))` in browser_run_code and take store_id, location_name, distance from data.nearby_stores.stores[].

For each store id (max 5) run `fetch('https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_v1?key=ff457966e64d5e877fdbad070f276d18ecec4a01&tcin=<tcin>&store_id=<store_id>').then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))` in browser_run_code.

If data.product.tcin differs from <tcin>, report both ids.

From data.product.fulfillment read sold_out; from store_options[0] read store.location_name, order_pickup.availability_status, in_store_only.availability_status, location_available_to_promise_quantity; from shipping_options read availability_status and services[].min_delivery_date.

On HTTP 435, or a body with appId or blockScript, report api_blocked with the URL and do not run it again. On HTTP 404 with "No product found" report tcin_not_found. On HTTP 206 naming a digital store report store_id_invalid and use the ZIP path.

If api_blocked, open https://www.target.com/p/-/A-<tcin>, click "Continue shopping" if the Health Data Consent modal shows, wait 2.5 s, read the pickup, delivery and shipping text as rendered. Stop and report the URL on a captcha, challenge page, sign in, 2FA, or payment wall.

Report a table of store_id, name, distance, pickup, in-store, quantity, then shipping status and earliest delivery date.

### Read the result

All paths are under `data.product.fulfillment`.

| Field | Path and values |
|---|---|
| pickup | `store_options[0].order_pickup.availability_status`, `IN_STOCK` or `UNAVAILABLE` |
| in_store | `store_options[0].in_store_only.availability_status`, `IN_STOCK` or `NOT_SOLD_IN_STORE` |
| quantity | `store_options[0].location_available_to_promise_quantity`, a float; `0.0` with `UNAVAILABLE` is no stock at that store |
| shipping | `shipping_options.availability_status`; its `available_to_promise_quantity` reads `10.0` for in-stock items, so report "10 or more" |
| flags | `sold_out`, `is_out_of_stock_in_all_store_locations`; true with `NOT_SOLD_IN_STORE` is an online-only item |

`data.product.tcin` can differ from the requested TCIN, which is why you report both ids.

The browser PDP fallback reads rendered text, so it names that read and marks the quantity unreadable.

### When blocked

- HTTP 435 or a PerimeterX body from any redsky URL is `api_blocked`, as in the search section. No retry, no key rotation; go to the browser PDP at once. Then hand the user the PDP URL or name another retailer.
- `tcin_not_found`: check the id against the `/-/A-<tcin>` part of the user's URL before reporting it.
- If a captcha, challenge page, sign in prompt, password, 2FA code, or payment request appears, stop and report which wall and on which URL. Do not try to solve or bypass it.
