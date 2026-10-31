# Site guide: Etsy

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## Etsy search products

### When to use

The user wants Etsy listings for a query ("hand poured soy candles under $50, sorted by top reviews"), optionally filtered by price, item type, shipping, sale, or ordering. You need the query and filters. The user gets listing id, title, shop, URL, price and original price, rating and review count, badges, free shipping flag, and an `is_ad` flag separating organic results from Etsy Ads. Read only; Etsy's Open API v3 is partner gated, so the consumer search page is the surface.

### Fastest path

Warm up on the homepage, submit the query through the search box, then apply filters by URL in the same tab. In earlier testing a cold deep link to `/search?q=` drew the DataDome captcha far more often than the homepage did, and a plain HTTP fetch of `/search` returned a DataDome 403, so there is no plain HTTP path and fetch_url will not work.

Filter parameters appended to `https://www.etsy.com/search?q=<query>`.

| Filter | URL param |
|---|---|
| Ordering | `&order=most_relevant` (default), `most_recent`, `price_asc`, `price_desc`, `highest_reviews` |
| Price | `&min=25&max=50` (whole dollars) |
| Handmade / Vintage / Craft supply | `&is_handmade=true` / `&is_vintage=true` / `&is_supply=true` |
| Digital downloads | `&instant_download=true` (a bare search appends `&instant_download=false`) |
| Free shipping | `&free_shipping=true` |
| On sale | `&is_discounted=true` |
| Ships to country | `&ship_to=US` (ISO code) |
| Customizable / Personalizable | `&customizable=true` / `&is_personalizable=true` |
| Color | `&attr_1=<colorId>`, ids only from the left rail links |
| Category | taxonomy path such as `/c/home-and-living/home-decor/candles`, or the left rail category links |
| Pagination | `&page=2` (about 64 results per page) |

Dynamic facets (material, occasion, recipient, style, holiday, room) are per category and multi select; read their `href`s off the left rail and append them. Worked example.

```
https://www.etsy.com/search?q=hand+poured+soy+candle&order=highest_reviews&min=25&max=50&is_handmade=true&free_shipping=true
```

### Steps

Search Etsy for the user's query and filters. Read only, never add to cart, favorite, or sign in.

Open https://www.etsy.com/ and wait 7 s. If the title is exactly "etsy.com" or a captcha-delivery.com iframe is present, stop and report the DataDome wall.

Type "<query>" into input[name="search_query"] and submit. Wait 6 s.

Then open https://www.etsy.com/search?q=<query with + for spaces><&order=highest_reviews|most_recent|price_asc|price_desc><&min=<n>&max=<n>><&is_handmade=true><&free_shipping=true> in the same tab and wait 4 s.

With browser_run_code iterate div.js-merch-stash-check-listing.v2-listing-card, dedupe by data-listing-id, and read data-shop-id, a.v2-listing-card__img href (cut at ?) and aria-label (title), img src, .currency-symbol plus .currency-value, any "Original Price" amount, the "N star rating with M reviews" aria-label, and whether the card contains "Ad from shop", "Bestseller", "Free shipping".

If a captcha, sign in or password, 2FA, or payment prompt appears at any point, stop and report it with the URL.

Report a table of listing_id, title, shop_id, listing_url, image_url, price, original_price, rating, review_count, badges, is_ad, free_shipping, in page order with ads flagged.

### Read the result

Per card patterns from the source, for use on a card's HTML.

| Field | Pattern |
|---|---|
| listing_id / shop_id | `data-listing-id="(\d+)"` / `data-shop-id="(\d+)"` |
| listing_url, title | `<a class="v2-listing-card__img" ... href="(...)" aria-label="(...)">`, URL up to `?`, title is the `aria-label` (decode `&amp;`) |
| image_url | `src="(https://i\.etsystatic\.com/.../il_300x300\.\d+_\w+\.jpg)"`, swap `300x300` for `640xN` for a larger image |
| price | `currency-symbol">([^<]+)<` plus `currency-value">([\d.,]+)<` |
| original_price | `Original Price[^$]*\$([\d.,]+)` (only when discounted) |
| rating, review_count | `aria-label="([\d.]+) star rating with ([\d.,kK]+) reviews"` (counts are abbreviated, `3.8k`) |
| is_ad | `<span class="wt-screen-reader-only">Ad from shop ([^<]+)</span>` |
| bestseller | contains `Bestseller` (the href also carries `&bes=1`) |
| free_shipping | contains `Free shipping` |

- The hidden `<form action="/cart/listing.php">` in each card carries `<input name="listing_id">` and `<input name="listing_url">` as a stable fallback for id and URL.
- The one `ld+json` block is an `ItemList` of the first few listings only (name, url, shop as `brand`, image, offer price), so read the cards for the full page. There is no `__INITIAL_STATE__`.
- About 23 of about 59 page one cards are ads, and `data-listing-id` repeats about 6 times per card across nested nodes. Never infer organic from position; always dedupe by id.
- The result count is no longer surfaced numerically. Report `result_count_text` as null.

### When blocked

- The wall is DataDome (`Server: DataDome`, `geo.captcha-delivery.com`). Two flavors. Interrogation (`rt:i`) auto solves in a few seconds of JS. Captcha (`t:bv`) is an iframe and cannot be solved.
- Tells. A title of exactly `etsy.com`, or a `captcha-delivery.com` iframe in the body.
- In earlier testing a `t:bv` captcha flagged the IP and the fix was a fresh proxy IP, which you cannot do; your browser's address may hit the same wall, not yet verified. Do not reload a challenged page repeatedly.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared, its tell, and the URL it was on.
