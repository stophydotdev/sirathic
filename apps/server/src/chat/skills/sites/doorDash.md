# Site guide: DoorDash

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

Jobs in this file: DoorDash menu extraction; DoorDash pickup or delivery order; DoorDash place after the user's yes; DoorDash search and store discovery.

DoorDash has four sections. The menu section is read only. The order section builds the cart and stops at the checkout read-back. The place section places, and only after the user's yes to the confirmation. The search section, last in this file, is read only and finds open stores for a dish, a cuisine or a store name so you can resolve the `/store/` URL the order section needs. Use the one that matches the step you are on, never two.

## DoorDash menu extraction

### When to use

The user wants the menu of a restaurant on DoorDash, either the template menu of a chain or a specific store's menu with its local prices. You need a DoorDash URL, or a restaurant name plus city. The result is a list of categories with item name, price, description, tags such as Popular, and availability. Nothing is added to a cart.

### Fastest path

DoorDash has two URL surfaces for the same restaurant. Pick by input.

| Input | Surface |
|---|---|
| `/store/{slug}-{storeId}/` URL, per-store pricing wanted, or an independent restaurant | Browser path on `/store/...` (Cloudflare challenge) |
| `/business/{slug}-{businessId}/` URL, or a chain name where template pricing is enough | Open `/business/.../menu` in your browser (server-rendered HTML, but it can get the same Cloudflare interstitial as `/store/`, see When blocked) |

Chain menu, one browser_navigate to the `/business/` menu page. In earlier testing a plain request returned 200 without a Cloudflare challenge on 2026-05-15, but on 2026-09-12 the same request came back without parseable menu HTML and fetch_url of DoorDash timed out, so do not use fetch_url. Give it one try, and go to the `/store/` Browser path if it does not return menu HTML.

`https://www.doordash.com/business/{slug}-{businessId}/menu`

`https://www.doordash.com/business/chipotle-mexican-grill-115/menu`

To resolve a chain name to a businessId, run search_web for the chain name and DoorDash and take the `/business/{slug}-{businessId}/` link from the results. If no `/business/` page exists the restaurant is an independent, so use the Browser path with its `/store/` URL. `https://page-service.doordash.com/en-US/store/{slug}-{id}/` serves the same server-rendered HTML body.

### Steps

Get the menu for the restaurant in its city: categories in order, item names, and price strings. Read only, never add to cart or check out. If a password, 2FA, captcha, or payment prompt appears, stop and report it with the URL.

Sources, in order: the DoorDash /store/<slug>-<storeId>/ URL if known, then the restaurant's own online ordering page if known. Try each once. Use the first source that gives categories and prices and skip the rest.

If you have a /business/<slug>-<businessId>/ URL or the restaurant is a chain, browser_navigate to https://www.doordash.com/business/<slug>-<businessId>/menu once and read the <script type="application/ld+json"> block (hasMenuSection[], hasMenuItem[], offers.price) or __NEXT_DATA__ with browser_run_code. If that fails, continue with the sources below.

For a /store/ URL, browser_navigate to https://www.doordash.com/store/<slug>-<storeId>/?pickup=true and wait 4 s. If the title is "Just a moment..." or the URL contains __cf_chl_tk after another 5 s, move to the next source.

If an address modal appears, fill input[placeholder='Address'] with "<city>, <state>", pick the first menuitem, click Save.

Scroll down six times (500 ms apart), snapshot once, read each region MenuItem-{itemId} for name and price. aria-disabled="true" means sold out.

Report: source used, URL read, categories in order with item name and price string, sold out marked. Skip descriptions and tags unless asked. On failure, the error and URL for each source tried.

### Read the result

Three embedded sources, in order of preference. Read them from the open page with browser_run_code: `[...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent)` or `document.querySelector('#__NEXT_DATA__')?.textContent`.

- JSON-LD `Restaurant` / `Menu` with `hasMenuSection[]`, `hasMenuItem[]`, `name`, `description`, `offers.price`, `offers.priceCurrency`. Cleanest source.
- `__NEXT_DATA__` with menu data under `props.pageProps.<...>.menu.categories[].items[]`. The shape changes occasionally, so parse defensively.
- HTML as last resort. `<h2 data-anchor-id="MenuItem-{itemId}">`, `<span data-anchor-id="MenuItem-Price">`, category headers as `<h2>` inside `<div data-anchor-id="StoreMenuList">`.

Price strings like `$13.65*` mean starting price with required modifiers and `$13.65+` means base price with optional add-ons. Keep the string as shown, strip the suffix for a numeric value, and flag `base_price`. Sold-out items carry `aria-disabled="true"` on the item region, so report them as unavailable instead of dropping them. Locale prefixes `/en-CA/`, `/en-AU/`, `/en-NZ/`, `/en-GB/`, `/fr-CA/` exist and show local currency, so keep `offers.priceCurrency`.

### When blocked

- `Timeout 25000ms` or `net::ERR_CONNECTION_CLOSED` on a `/store/` URL is not a Cloudflare challenge, and a retry does not help. On 2026-09-12 the timeout came once and the connection error twice on the same store URL inside four minutes.
- Every `/store/` URL sits behind a Cloudflare managed challenge (`<title>Just a moment...</title>`, `cType: 'managed'`, `cZone: 'www.doordash.com'`). In earlier testing only a JS-executing browser cleared it, and your browser's address may hit the same wall. Once cleared, the `__cf_bm` cookie (about 30 minutes) carries across `/store/` pages.
- `/business/{slug}-{businessId}/menu` can return the same Cloudflare interstitial as `/store/`. An empty read of the page (no JSON-LD, no `__NEXT_DATA__`) together with a `Just a moment...` title means the `/store/` path only, and you do not retry the `/business/` page. With a `/store/` URL take the `/store/<slug>-<storeId>/?pickup=true` path from the Steps at once; without one, resolve it with the search section at the end of this file first.
- A 403 with the DoorDash-branded error page ("We're having trouble loading the page you requested." with a Ray ID) is a block, not a challenge to wait out.
- `consumer-mobile-bff.doordash.com/v3/stores/{id}/` and `/v1/stores/{id}/menu` return `401 {"name":"authorization_invalid","message":"Access Denied"}` without a user JWT. `m.doordash.com` returns 500. Do not probe either.
- Stop and report if the page asks for a password, a 2FA code, a captcha, or a payment, naming the wall and the URL. Do not try to solve or bypass it.

## DoorDash pickup or delivery order

### When to use

The user has approved a restaurant. You hold the `/store/` URL from the menu read or the user's link, the exact items with options and quantities, pickup or delivery, and for delivery the address to confirm. The result is the cart and every checkout line read back, with nothing placed. Placing is its own step in the next section, after the user's yes to the confirmation. A cart change after that confirmation spends the yes, so read the changed cart back and ask again with clarifying_questions before you place.

### Fastest path

Build the cart and read back checkout in one browser_task. Give it the `/store/` URL (with `?pickup=true` for pickup), the item list, and the stop rule. Never start without the URL, and never go to a past order to copy. On a live order on 2026-09-12 the URL was steered in after the work had started, and it then left the store page for order history. That detour took ten rounds and about 85 seconds, with two navigations, a scroll hunt through order history, and a click by screen position, before the first item.

A change to the same cart goes in the same tab. If your tab no longer shows the store, open the URL again.

A read-only menu read that took the browser path ends on a URL. When that is a `/store/` URL, carry it, and the item names as the menu spelled them, into the cart step. The `/business/` fast path ends on a `/business/` URL, which names a brand, not a location, and a menu that you got from another host ends on that host's URL. The cart step can use neither. Resolve the `/store/` URL first: the user's link, the account's order history read only, the `/business/` page that picks the user's location and lands on a `/store/` URL, or the search section at the end of this file.

### Steps

On DoorDash, build the pickup or delivery cart from the user's items, options and quantities, and stop at the checkout page without placing it.

browser_navigate to https://www.doordash.com/store/<slug>-<storeId>/?pickup=true in the current tab (drop ?pickup=true for delivery), wait 4 s. On "Just a moment..." wait 5 s more, then stop and report the Cloudflare wall. If an address modal appears, fill input[placeholder='Address'] with "<city>, <state>", pick the first menuitem, click Save.

For each item, click it, set the listed options and quantity in the dialog, click the add control, and continue. Take a required option the user did not list as the dialog's default and name it in your summary. Do not open the cart between items.

Then open the cart once, check each line, click checkout, and read the checkout page. Never click the place-order control, a tip, a promo, or an upsell.

If a sign-in, password, 2FA, captcha, or new-payment prompt appears, stop and report it with the URL.

Report the store URL, pickup or delivery, each cart line with options, quantity, and price, subtotal, fees, tax, preselected tip, total, the store address and pickup time or the delivery address and ETA, and any default you took.

### When blocked

- The Cloudflare challenge and the 401 endpoints from the menu section apply here too.
- Stop and report if the page asks for a sign-in, a password, a 2FA code, a captcha, or a new payment method. Handle those with request_user_form or `request_browser_help` as the browser skill's Sign-ins and private details steps say, then continue.
- If an item's required option is not in the user's request, take the default the dialog preselects and name it in your summary. Do not stop for it.

## DoorDash place after the user's yes

### When to use

The user's yes to the confirmation for this exact cart came back, and nothing changed since. These steps are only for placing. They never go into building the cart, which is the section above.

### Fastest path

Your tab still holds the checkout page you read back, so the place is one click and one confirmation read. Compare it with the lines the confirmation read back so you can refuse a cart that drifted.

### Steps

Place the DoorDash order now. The checkout page should be open in your tab with the lines the user confirmed. If it is not open, browser_navigate to the store URL the cart step used, with ?pickup=true only for pickup, in the current tab, open the cart, and click checkout. If any line differs from what the user confirmed, stop and report the difference without placing.

Click the place-order control once. Dismiss post-order prompts (rate, tip more, share, add items) without accepting anything. Read the confirmation page.

Report the order number if shown, the pickup time or ETA, and the total charged. If no confirmation appears within 20 s, report the page as it is. Do not click the place-order control again.

### When blocked

- A sign-in, password, 2FA, captcha, or new-payment prompt means stop and report with the URL, as in the cart section.
- No confirmation within 20 seconds means report the page as it is. Do not click the place-order control a second time.

## DoorDash search and store discovery

### When to use

The user names a dish, a cuisine, or a store (a restaurant, a grocery, a convenience or retail store on DoorDash) and an address or a city, and wants to know which stores are open, with ETA and fees, or you need a `/store/` URL for the menu or order section and have none. Read only. Nothing goes in a cart, no address is saved to an account, no sign-in.

### Fastest path

Browser only, behind the same Cloudflare edge as `/store/`. Open the search URL with the term URL-encoded and set the address.

```
https://www.doordash.com/search/store/<term>/
https://www.doordash.com/search/store/tacos/
```

The "Just a moment..." check clears on its own in about 6 s, then the page renders "Results for `<term>`" with an address control and store cards, each linking to a `/store/` URL. A plain request gets a 403 error page.

When the page is not a results list, fall back to a search from the home page.

### Steps

On DoorDash, find stores for the user's term near their address or city and state, and report them. Read only: never add to cart, check out, sign in, or save anything.

browser_navigate to https://www.doordash.com/search/store/<url-encoded term>/ in the current tab, wait 4 s. On "Just a moment..." wait 5 s more; if it stays, or the URL contains __cf_chl_tk, stop and report the Cloudflare wall. If the page is not a list of stores, browser_navigate to https://www.doordash.com/, search for "<term>" from the page's search control, wait 4 s.

If an address modal appears, fill input[placeholder='Address'] with "<address or city, state>", pick the first menuitem, click Save. If the header shows a different address, change it through that header control once; if it will not change, report the address DoorDash used.

Scroll down twice (500 ms apart), snapshot once. For the stores the user needs read name, open or closed, ETA, delivery fee, rating if shown, and the /store/<slug>-<storeId>/ link the card points to. Do not open store pages.

If a sign-in, password, 2FA, captcha, or payment prompt appears, stop and report it with the URL.

Report the address used, the term, and one line per store with those fields and its /store/ URL. On failure, the error and URL.

### Read the result

Each store line carries the `/store/{slug}-{storeId}/` URL. That URL, with `?pickup=true` for pickup, is what the menu section's browser path and the order section take. A `/business/` URL names a brand and not a location, so do not substitute one. ETA and fee are for the address the page shows, not the user's saved address, so read the address line before quoting them. A store shown closed still has a menu and a `/store/` URL, so keep it in the list and mark it closed.

### When blocked

- The Cloudflare rules from the menu section apply. A 403 with the DoorDash-branded error page is a block, not a challenge, and waiting does not clear it; report `cloudflare_blocked` with the URL.
- A results list with no store cards after the address is set means the term found nothing at that address.
- Retry once with a broader term (the cuisine instead of the dish), then report `no_stores_found` with the address used.
- If the address modal will not accept the address, or the header address cannot be changed, report the address DoorDash used and let the user decide. Do not sign in to change a saved address.
- Stop and report if the page asks for a sign-in, a password, a 2FA code, a captcha, or a payment. Handle those with request_user_form or `request_browser_help` as the browser skill's Sign-ins and private details steps say.
