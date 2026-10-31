# Site guide: Costco

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

Jobs in this file: Costco.com product page price and warehouse availability; Costco Same-Day cart from a grocery list.

The first section is read only on `www.costco.com`, the retail site. The second builds a grocery cart on `sameday.costco.com`, a separate storefront. Use the one that matches the site, never both.

## Costco.com product page price and warehouse availability

### When to use

The user has a costco.com product URL or item number, or names a product sold on costco.com, and wants its online price, whether it is in stock online, and what the page says about warehouse availability. Read only: nothing goes in a cart, no sign-in, no membership purchase. Groceries delivered from a warehouse are the Same-Day section, a different site.

### Fastest path

Product pages are server rendered. Open `https://www.costco.com/p/-/<slug>/<itemId>` in your browser: the price is in the `ProductSchema` JSON-LD block, and stock comes from the rendered fulfillment card. A plain request gets the Kasada 429, so do not use fetch_url. The search page's server HTML has no result tiles, so a name is resolved in the browser. Legacy `<slug>.product.<itemId>.html` URLs redirect to the `/p/-/` form.

### Steps

On costco.com, read price and stock for the product URL, item number, or name. Read only: never add to cart, sign in, or buy a membership.

Open https://www.costco.com/p/-/<slug>/<itemId>, or https://www.costco.com/s?keyword=<url-encoded name> then its first match; wait 4 s after each load.

Run `[...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent)` in browser_run_code for title, url (ends in the item number), brand, image, rating, price.

Read the price label (Online or Warehouse Price), stock (Out of Stock, Low Stock, or Add to Cart), and the fulfillment card's ZIP and warehouse. If its ZIP differs from the one the user gave, set it once there and re-read.

"Sign In for Price" is member_price_hidden; never sign in. "Warehouse pricing or availability may vary" with no warehouse stock shown is warehouse_unverified.

On a 429 or blank page, reload once after 5 s. On a captcha, sign-in, 2FA, payment prompt, or second 429, stop and report it with the URL.

Report URL, title, item number, brand, image URL, rating, price and label, online stock, the card's ZIP, warehouse and stock note.

### Read the result

- JSON-LD: `offers.price` and `offers.priceCurrency` are the online price, `sku` the internal SKU, `name` the title, the item number is the last path segment of `url`, and `brand.name`, `image`, and `aggregateRating` (`ratingValue`, `ratingCount`) give the brand, picture and rating. `offers.availability` can read `OutOfStock` while the page lists a price, so take stock from the rendered page and the fulfillment card (`data-testid="fulfillment-zipCode-and-warehouse-selector"`), not from the JSON-LD.
- `Online Price` marks a delivered price and `Warehouse Price` a warehouse one. `Warehouse pricing may vary` or `Item may be available in your local warehouse` is not a stock promise: report `warehouse_unverified`. `Sign In for Price` is `member_price_hidden`.

### When blocked

- A 429 or a blank page gets one reload after 5 s, then report `edge_blocked` with the URL. Do not retry it with fetch_url.
- Do not scrape search results with fetch_url.
- `Sign In for Price` means stop for the price. Ask the user whether to sign in and, if yes, follow the browser skill's Sign-ins and private details steps; never sign in on your own.
- Stop and report if any page asks for a password, a 2FA code, a captcha, a membership purchase, or a payment, naming the wall and the URL. Do not try to solve or bypass it.

## Costco Same-Day cart from a grocery list

### When to use

The user gives a grocery list and wants the best matching Costco Same-Day products added to the cart, ready to review. You need the item list and, optionally, a delivery ZIP. The result is one chosen product with price per list item, whether it came from purchase history, and the final cart count. The skill stops at the cart and never checks out. This is `sameday.costco.com`, not the retail site in the section above.

### Fastest path

`browser_navigate` to `https://sameday.costco.com/`. The page offers two buttons, `Sign in via Costco.com` and `Browse as a guest`. Click `Browse as a guest` unless the user's Chrome is already signed in, then wait for the load (about 10 seconds). You land on `https://sameday.costco.com/store/costco/storefront` with a header button `View Cart. Items in cart: N`.

Search is URL driven, so skip the search box. One navigation per list item, then wait 3 seconds for results.

```
https://sameday.costco.com/store/costco/s?k=<URL-encoded query>
https://sameday.costco.com/store/costco/s?k=organic%20milk
```

In earlier testing there is no anti-bot on the storefront, search, or add surfaces, and the internal Instacart backend is session-token gated, so the rendered storefront is the only path.

### Steps

On Costco Same-Day, add the user's list to the cart and stop at the cart. Never check out or pay.

browser_navigate to https://sameday.costco.com/ and click "Browse as a guest" (skip if already signed in), wait about 10 s.

Open https://sameday.costco.com/store/costco/buy_it_again. If it lists past purchases, prefer those for matching items; if it says "Reordering is a breeze", note history unavailable.

For each item, browser_navigate https://sameday.costco.com/store/costco/s?k=<url-encoded item>, wait 3 s, snapshot.

Pick the first genuine match (prefer Kirkland Signature), click its "Add 1 ct <name>" button, wait 2 s, and confirm "View Cart. Items in cart: N" went up by one.

If a Costco.com sign-in page, a 2FA code, a captcha, or a payment prompt appears, stop and report it with the URL.

Report the delivery ZIP from the header, each item with chosen product and price, whether it came from purchase history, anything with no match, and the final cart count.

### Read the result

Snapshots are large (500 to 700 refs), so look only for `Add 1 ct`, `Current price`, and `Items in cart`. The delivery ZIP appears in the header `Delivery <ZIP>` button and is set from the egress IP. Product prices and availability are ZIP specific, so report the ZIP you actually got, or set it through that button first if the user gave one.

### When blocked

- `Sign in via Costco.com` leaves the storefront for Costco's own SSO. If a password page appears, stop, report the sign-in wall and URL, and continue as a guest only if the user's request allows it.
- `/store/costco/storefront` and `/store/costco/buy_it_again` redirect to `/?next=...` until the guest or sign-in choice is made in the same session. Make that choice first, then navigate.
- In earlier testing no captcha or block appeared on a plain session, not yet verified from your browser. If one does, stop and report.
- Stop and report if any page asks for a password, a 2FA code, a captcha, or a payment, naming the wall and the URL. Do not try to solve or bypass it.
