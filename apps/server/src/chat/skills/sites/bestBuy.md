# Site guide: Best Buy

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

Jobs in this file: Best Buy search by name; Best Buy check stock.

## Best Buy search by name

### When to use

The user names a product or a spec ("65 inch OLED TV under $1500", "RTX 5060 prebuilt desktop", "AirPods Pro 2") and wants a Best Buy shortlist with SKU, title, price and the card's availability label, or you have a name and need the SKU before the check stock section below. You need the free text query and any price cap, brand or spec filter, and should ask the user for the ZIP when pickup matters. Read only. This section ends at a shortlist. Store stock, pickup and a Ship to Home ETA for a chosen SKU are the check stock section.

### Fastest path

Set the ZIP if pickup matters, then `browser_navigate` to `https://www.bestbuy.com/site/searchpage.jsp?st=<query with + for spaces>` and read the result cards from the rendered page. The SKU is in each card's product link: the `skuId=<sku>` query value, or the seven digits before `.p` in a `/site/...<sku>.p` path, the legacy URL shape in the check stock table, which 301s to the canonical PDP. There is no plain HTTP path: the edge resets plain requests on every bestbuy.com URL, and the developer API needs a key, so do not use fetch_url.

Worked example. `https://www.bestbuy.com/site/searchpage.jsp?st=65+inch+oled+tv`

### Steps

Search Best Buy for "<query>" <price cap, brand or spec filter>. Read only, never click Add to Cart, Pick up at Store, Sign In, or Add Protection.

If pickup matters, open https://www.bestbuy.com/, click "Update location" in the header, enter the ZIP, submit, wait for load.

Open https://www.bestbuy.com/site/searchpage.jsp?st=<query with + for spaces> and wait 2.5 s after load. If an Access Denied page, an interstitial that does not finish, a captcha, sign in or password, 2FA, or payment prompt appears, stop and report it with the URL. Do not reload.

With browser_run_code collect every anchor whose href contains "skuId=", matches /\/site\/.*(\d{7})\.p/, or matches /\/product\/[^/]+\/([A-Z0-9]{10})/; the SKU is the skuId value, the seven digits before ".p", or the digits after "/sku/", and a /product/ link gives the bsin. Keep one entry per product in page order, up to 12.

For each entry read the anchor text as the title, and from its card the img src, the price, any "The price was" amount, the "Rating X out of 5 stars with N reviews" text, and the availability button text. Report a field you cannot read as unreadable, never a guess.

Drop entries whose title is a different product type from the query. Apply the price cap or filter if given.

If the script finds no product links, report no_results when the page says nothing matched, else results_unreadable. Report a table of sku or bsin, title, image, price, was price, rating, review count, card availability label, and url (https://www.bestbuy.com/site/<sku>.p?skuId=<sku>, or the /product/ link), plus how many cards the page showed.

### Read the result

- The shortlist is a name to SKU step. The card's availability button is a rendered label that Best Buy A/B tests, so report it as `card_label`, not as stock; store stock, pickup and a Ship to Home ETA come from the check stock section run on the chosen SKUs.
- Without the ZIP step the grid is scoped to Best Buy's HQ ZIP `55423`; never report a card label read that way as the user's pickup availability.
- A SKU is seven digits and a bsin ten characters. An entry with only a bsin goes to the check stock section as its canonical `/product/<slug>/<bsin>` URL, which reads `sku` from `script#product-schema`.
- Report `no_results` only when the page says nothing matched. Product cards the script could not read are `results_unreadable`. Do not report a related-products row as a match.

### When blocked

- Akamai Bot Manager fronts the site, as in the check stock section, and there is no plain HTTP fallback.
- If an Access Denied page or an interstitial that does not finish appears, stop and report it with the URL. Give the user the search URL for their own browser, or move to another retailer. Do not run a second Best Buy search into the same wall.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.

## Best Buy check stock

### When to use

The user has a Best Buy SKU (numeric, such as `6418599`) or product URL and wants the current price, Ship to Home availability with ETA, and pickup availability at stores near a ZIP, plus title, brand, model, and any "Limit X per customer" notice. You need the SKU or URL and should ask the user for the ZIP; without it Best Buy scopes fulfillment to its HQ ZIP. Read only. To turn a product name into a SKU, run the search section above first; this section takes a known SKU or URL only.

### Fastest path

Set the ZIP, then `browser_navigate` to the product page. All fulfillment data is embedded in the SSR HTML as Apollo cache events, so one navigation is enough. There is no plain HTTP path; in earlier testing the page sits behind Akamai Bot Manager, and the developer API at `https://api.bestbuy.com/v1/products(...)` needs a key and has no store level stock.

| Scheme | URL | Behavior |
|---|---|---|
| Legacy | `https://www.bestbuy.com/site/{sku}.p?skuId={sku}` | 301 to canonical |
| Canonical | `https://www.bestbuy.com/product/{slug}/{bsin}` | direct PDP; `bsin` is a 10 character id such as `JJ8ZHP82P6` |

Worked example. `https://www.bestbuy.com/site/6418599.p?skuId=6418599`

### Steps

Check Best Buy stock for <SKU, or a /product/<slug>/<bsin> URL> at ZIP <zip>. Read only, never click Add to Cart, Pick up at Store, Sign In, or Add Protection.

Open https://www.bestbuy.com/, click "Update location" in the header, enter <zip>, submit, wait for load.

Open https://www.bestbuy.com/site/<sku>.p?skuId=<sku> (or the /product/ URL given) and wait 1.5 s after load. If an Access Denied page, captcha, sign in or password, 2FA, or payment prompt appears, stop and report it with the URL.

Run `JSON.parse(document.querySelector('script#product-schema').textContent)` in browser_run_code for name, sku, model, brand.name, url, image, aggregateRating, offers.

Run `(() => { const t = [...document.querySelectorAll('script')].map((s) => s.textContent).filter((s) => s.includes('ApolloSSRDataTransport')).join('\n'); const k = '"productBySkuId":{'; const out = []; for (let i = t.indexOf(k); i !== -1; i = t.indexOf(k, i + 1)) { const a = t.indexOf('{', i); for (let e = t.indexOf('}', a); e !== -1; e = t.indexOf('}', e + 1)) { try { out.push(JSON.parse(t.slice(a, e + 1))); break; } catch {} } } return out; })()` in browser_run_code for each Apollo productBySkuId; one carries fulfillmentOptions.

When a SKU was given, confirm productBySkuId.skuId equals it, otherwise report sku_not_found. Confirm shippingDetails[].destinationZipCode equals <zip>.

Map buttonStates[].buttonState (ADD_TO_CART or BUY_NOW in stock, SOLD_OUT, COMING_SOON, NOT_AVAILABLE, CHECK_STORES). Read price.customerPrice, the "Get it by" ETA, and ispuDetails[].nearbyLocations[] store displayName, distance, pickupEligible, minPickupInHours, quantity.

Report title, price, online availability and ETA, and a table of nearby stores with availability.

### Read the result

- JSON-LD `Product` has `name`, `sku`, `model`, `brand.name`, `color`, `url`, `image`, `aggregateRating.ratingValue`, `aggregateRating.reviewCount`, `additionalProperty[]` (spec sheet), `offers[]`. For inactive products `offers[]` is empty or refurbished only and the price is in the Apollo cache.
- Apollo `type: "next"` events carry `value.data.productBySkuId`.

| Query | Fields |
|---|---|
| `InactiveProductHeader_Init` / `PDP_ProductSkuIdComposite_Init` | `productBySkuId.{brand, skuId, name.short, manufacturer.modelNumber, primaryImage.piscesHref, dotComDisplayStatus, bsin, upc}` |
| `FulfillmentOptionHook_FulfillmentDynamicQuery` | `productBySkuId.price.customerPrice`, `productBySkuId.fulfillmentOptions.{buttonStates[], shippingDetails[], deliveryDetails[], ispuDetails[]}` |

- Online state comes from `fulfillmentOptions.buttonStates[].buttonState`. `ADD_TO_CART` or `BUY_NOW` is In Stock, `SOLD_OUT` is Sold Out, `COMING_SOON` is Coming Soon (read `releaseDateDisplayValue`), `NOT_AVAILABLE` is Currently Unavailable, `CHECK_STORES` means online unavailable but pickup may be. Do not trust the visible button label; it is A/B controlled.
- Ship to Home ETA is in `shippingDetails[].shippingAvailability[].customerLOSGroup` (`displayDateType`, `minLineItemMaxDate`, `maxLineItemMaxDate`, `name`). The rendered "Get it by Wed, May 20" string sits near `"shippingDisplayDateType"` in the HTML. `shippingEligible: false` means no Ship to Home. Check that `shippingDetails[].destinationZipCode` equals the user's ZIP.
- Pickup is `ispuDetails[].nearbyLocations[]`. Each has `availability.{maxDate, minPickupInHours, pickupEligible, quantity, fulfillmentType}` and `store.{storeId, displayName, address, city, state, zip, distance}`. `pickupEligible` with `minPickupInHours <= 24` is Available Today, above 24 is Available Tomorrow (or `maxDate`), `pickupEligible: false` is Not Available. The radius is server fixed near 25 miles and about 10 stores; post filter on `store.distance` (miles) for a custom radius.
- Price is `productBySkuId.price.customerPrice` for `planPaidMemberType: "NULL"` (logged out). Member tiers need a signed in session; report them as null.
- `dotComDisplayStatus: "inactive"` with `buttonState NOT_AVAILABLE`, `shippingEligible false`, and `pickupEligible false` is a discontinued product, not an error. Report Currently Unavailable plus any refurbished offer.
- "Limit X per customer" is a rendered string; search the HTML for `Limit\s+\d+\s+per\s+customer`.

### When blocked

- Akamai Bot Manager (`_abck`, `bm_sz`, `bm_ss`, `bm_s`, `bm_so`, `akacd_PR_www_bestbuy_com`, `bby_cbc_lb` cookies). In earlier testing a plain session got a 403 Access Denied page or interstitial on first navigation and a stealth residential session was needed; your browser's address may hit the same wall, not yet verified.
- The default location is ZIP `55423`, store `7` (Richfield, MN). If `destinationZipCode` is not the user's ZIP, redo step 1 and reload. Never report HQ scoped stock as the user's.
- `POST https://www.bestbuy.com/gateway/graphql` (operation `FulfillmentOptionHook_FulfillmentDynamicQuery`, variables `skuId`, `fulfillmentInput`, `productPriceInput`, `openBoxCondition`) is the site's own source, but it was not verified cookieless and is expected to be Akamai gated. Do not call it with fetch_url.
- If an Access Denied page or interstitial appears, stop and report it with the URL.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.
