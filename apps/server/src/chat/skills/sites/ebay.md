# Site guide: eBay

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

Jobs in this file: eBay search products; eBay item page.

## eBay search products

### When to use

The user wants eBay listings for a keyword, optionally scoped by category, condition, price, location, format, or seller, or wants recent sold prices ("what did an iPhone 12 sell for"). You need the query and any filters; a full `/sch/i.html` URL can be used as is. The user gets a table of listings with item id, title, condition, price, shipping, location, seller, and `/itm/<itemId>` URL, plus the page result count. Read only. A known item id or a pasted `/itm/` URL is the item page section below, not a search.

### Fastest path

Look it up with stophy_call, id ebay.search: query, condition (new or used), auctionsOnly, minPrice, maxPrice, sort, and page. It does not list sold items; for sold prices use the browser URL below. Otherwise build the search URL and `browser_navigate` to it, when Stophy fails or for a filter it does not take. There is no usable plain HTTP path, so do not use fetch_url; in earlier testing a plain fetch is redirected to `/splashui/challenge`, and eBay's Browse API (`api.ebay.com/buy/browse/v1/item_summary/search`) needs approved developer credentials. Base is `https://www.ebay.com/sch/i.html` with these parameters.

| Parameter | Meaning |
|---|---|
| `_nkw=<query>` | Keyword, URL encoded with `+` for spaces. The only required field. |
| `_sacat=<id>` | Category leaf id (`183454` CCG Individual Cards, `9355` Cell Phones & Smartphones) |
| `LH_ItemCondition=<code>` | `1000` New, `1500` New other, `1750` New with defects, `2000` Manufacturer refurbished, `2010` Certified refurbished, `2020` Excellent refurb, `2030` Very Good refurb, `2500` Seller refurbished, `3000` Used, `4000` Very Good (books/media), `5000` Good, `6000` Acceptable, `7000` For parts or not working. Union as `1000\|1500`. |
| `LH_BIN=1` / `LH_Auction=1` / `LH_BO=1` | Buy It Now only / Auction only / Best Offer enabled |
| `LH_FS=1` | Free shipping |
| `LH_Sold=1&LH_Complete=1` | Sold and completed, for comp pricing. Always pair both. Sometimes challenged when signed out; see When blocked. |
| `LH_PrefLoc=<n>` | `1` US Only, `2` North America, `3` Worldwide, `4` Europe, `5` Asia |
| `LH_TopRatedPlus=1` | Top Rated Plus sellers only |
| `LH_TitleDesc=1` | Search title and description |
| `_udlo=<n>` / `_udhi=<n>` | Price min / max, integer dollars |
| `_stpos=<ZIP>&_dmd=<mi>` | Within X miles of ZIP. Without `_stpos` eBay infers the shipping ZIP from your browser's IP and prices delivery against it. |
| `_sasl=<seller>&_saslop=1` | Only this seller |
| `_ipg=<n>` | Items per page, `60`, `120`, or `240` only; anything else coerces to 60 |
| `_pgn=<n>` | Page number, 1 indexed |
| `_sop=<n>` | Sort. `12` Best Match (default), `1` Ending soonest, `10` Newly listed, `2` Price lowest, `3` Price highest, `15` Price+Shipping lowest, `16` Price+Shipping highest, `7` Distance nearest |

Worked examples.

```
https://www.ebay.com/sch/i.html?_nkw=vintage+Levi+501+size+32&_ipg=60
https://www.ebay.com/sch/i.html?_nkw=iphone+12&LH_Sold=1&LH_Complete=1&_ipg=60
https://www.ebay.com/sch/i.html?_nkw=Charizard&_sacat=183454&LH_ItemCondition=3000&_sop=15&_ipg=60
```

### Steps

Search eBay for the user's query and filters. First try stophy_call with ebay.search, except for sold prices. Read only, never click Buy It Now, Place bid, Make offer, Add to Watchlist, Add to cart, or Sign in.

Open https://www.ebay.com/sch/i.html?_nkw=<query with + for spaces>&_ipg=60<&LH_Sold=1&LH_Complete=1 for sold comps><&_udlo=<min>&_udhi=<max>><&LH_ItemCondition=<code>><&_sop=<n>>. Wait 2.5 s.

If the title is "Access Denied", "Error Page | eBay", or "Pardon Our Interruption", or a captcha, sign in or password, 2FA, or payment prompt appears, stop and report the wall and the URL. Do not reload and do not open another eBay URL.

With browser_run_code iterate li.s-card and read a.s-card__link href (item id is the /itm/(\d{8,}) part), .s-card__title, .s-card__subtitle, .s-card__price, .s-card__image img src, and the .s-card__attribute-row and .s-card__footer--row texts.

Drop the "Shop on eBay" placeholder card (item id 123456 or no data-listingid).

Split a price like "$92.92$109.32" into price and was price. Subtitle segment 0 is the condition.

Flag a card as sponsored if its last row, with U+2063 and whitespace stripped, reads "sponsored".

Read h1.srp-controls__count-heading for the result count.

Report a table of itemId, url https://www.ebay.com/itm/<id>, title, image src, condition, price, was price, shipping, location, seller, format, watchers or sold count, sponsored.

### Read the result

- The legacy `.s-item__*` selectors no longer match. Use `.s-card__title`, `.s-card__subtitle`, `.s-card__price`, `.s-card__attribute-row`, `.s-card__footer--row`.
- `data-listingid` on the `<li>` is an internal tracking id, not the item id. Always take the item id from the `/itm/(\d{8,})` part of the href.
- The price node concatenates sale and strikethrough with no separator, `$92.92$109.32`. Parse with `/^(\$[\d,.]+)(\$[\d,.]+)?$/`; capture 2 is the was price. Ranges read `$0.99 to $3.00`.
- The subtitle is condition plus item specifics joined by ` · ` (`Pre-Owned · Size 32`). `[0]` is the condition, the rest are specifics.
- Classify each attribute row by regex.

| Field | Regex |
|---|---|
| buyFormat | `/buy it now\|or best offer\|best offer accepted\|auction/i` |
| bidCount | `/^(\d+)\s+bids?\b/i` |
| shipping | `/^\+\$\|^free delivery\|^free shipping\|delivery$\|shipping$/i` |
| location | `/^located in /i` |
| returnsAccepted | `/^free returns$/i` |
| watchers | `/^(\d+)\s+watchers?\b/i` |
| soldCount | `/^(\d+)\s+sold\b/i` |
| coupon | `/coupon\|% off/i` |
| seller | `/^(\S+)\s+(\d+(?:\.\d+)?)%\s+positive\s+\(([^)]+)\)/i` (`34.3K` is 34300, `1.4M` is 1400000) |
| skip | `/^view similar active items$\|^sell one like this$/i` |

- The sponsored marker in the last row is obfuscated with U+2063 and decoy letters, so `includes("Sponsored")` is false. Strip `[\u2060-\u2064\u200B-\u200D\uFEFF]` and whitespace, lower case, then test for `sponsored`.
- The result count reads `776 results for ...` or `18,000+ results for ...`; a `+` means approximate. "Authenticity Guarantee" appears as a row only in supported categories (`_sacat=15709` sneakers, `14324` watches, `169291` handbags, trading cards over $250).
- Sold mode uses the same selectors. The bid row is the final count (`41 bids`), `Best offer accepted` marks an OBO sale, the seller row surfaces reliably, and `.s-card__price` is the sold price. The per card sold date has no stable selector; the item page shows `Sold on <date>` under `.x-item-sold-history`.
- Item page (`https://www.ebay.com/itm/<itemId>`) selectors. Title `h1.x-item-title__mainTitle span.ux-textspans`, price `.x-price-primary .ux-textspans`, bids `.x-bid-count .ux-textspans`, time left `.ux-timer__time .ux-textspans` (plus `<meta itemprop="endDate">`), condition `.x-item-condition-text .ux-textspans`, seller `.x-sellercard-atf__info__about-seller a` and `.x-sellercard-atf__data-item-block`, shipping `.ux-labels-values--shipping`, specifics `.ux-layout-section-evo__item--table-view dl`, images `.ux-image-carousel-item img`, canonical `<link rel="canonical">`.

### When blocked

- eBay is fronted by Akamai. Tells are a page title of exactly `Access Denied` with a `Reference #` line and an `errors.edgesuite.net` link, `Pardon Our Interruption...` at `/splashui/challenge`, or an HTTP 403 whose title is `Error Page | eBay` with a `SORRY` headline and a `reference-id` line. It shows on `/sch/`, `/itm/`, and the homepage, while a HEAD request returns 200 with an empty body, so a status check proves nothing. `m.ebay.com` and `&_rss=1` are gated the same way.
- In earlier testing, 40 to 60 percent of fresh cloud sessions were blocked on first navigation even with stealth and residential proxies, and the fix was rotating to a new IP, which you cannot do. Your browser is challenged often, so plan the next step before you search.
- The first challenge ends searching in that session. Repeated `/sch/` navigations in one session make the block worse, so do not try a second query, a narrower query, a homepage warmup, or the same URL again. Report the wall, the title and the URL and stop. Do not try to solve the challenge.
- Your next step, in this order. Hand your browser to the user for one verification with request_browser_help, then open the same URL again; or open a user-pasted `/itm/` URL with the item page section below; or move to other sources such as ebay.search in Stophy. Do not start a second eBay search for the same query, and do not report prices from a page that never rendered.
- Sold and completed searches (`LH_Sold=1&LH_Complete=1`) often work signed out and are sometimes challenged on the first sold URL. When one is challenged, offer the user a hand-off of your browser to sign in to eBay and open the same URL again; do not run another signed-out sold search. Credentials never go in chat.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.

## eBay item page

### When to use

The user has an eBay item id or pasted a `/itm/` URL and wants the current state of that one listing: title, price, format (auction with a bid count, or Buy It Now), time left and end date, condition, seller, shipping, and item specifics. Also the fallback when a search was challenged and the user pastes the listing instead. You need the item id or URL and nothing else. Read only.

### Fastest path

Look it up with stophy_call, id ebay.item: itemId or itemUrl. It also returns what an ended auction sold for. Otherwise, when Stophy fails or for a field it does not return, `browser_navigate` to `https://www.ebay.com/itm/<itemId>`; a pasted URL with a slug or query string works as is. There is no plain HTTP path (the same 403 `Error Page | eBay` as search). The selectors are the item page ones under Read the result in the search section. One navigation per item, only for the ids the user named.

### Steps

Read the eBay item the user named. First try stophy_call with ebay.item. Read only, never click Buy It Now, Place bid, Make offer, Add to Watchlist, Add to cart, or Sign in.

Open https://www.ebay.com/itm/<itemId>. Wait 2.5 s.

If the title is "Access Denied", "Error Page | eBay", or "Pardon Our Interruption", or a captcha, sign in or password, 2FA, or payment prompt appears, stop and report the wall and the URL. Do not reload and do not open another eBay URL.

With browser_run_code read h1.x-item-title__mainTitle span.ux-textspans, .x-price-primary .ux-textspans, .x-bid-count .ux-textspans, .ux-timer__time .ux-textspans, the content of meta[itemprop="endDate"], .x-item-condition-text .ux-textspans, .x-sellercard-atf__info__about-seller a, .x-sellercard-atf__data-item-block, .ux-labels-values--shipping, the .ux-layout-section-evo__item--table-view dl pairs, link[rel="canonical"] href, and meta[property="og:image"] content.

Format is auction when the bid count node is present, otherwise Buy It Now. For an ended listing read .x-item-sold-history for "Sold on <date>".

If the title node is missing and no wall appeared, report item_not_found with the page title.

Report itemId, url, title, image URL, price, format, bids, time left and end date, condition, seller and feedback, shipping, up to 8 item specifics, and whether the listing has ended.

### Read the result

- The bid count node present means an auction and its text is the bid count; absent means Buy It Now. Report both `meta[itemprop="endDate"]` and the rendered countdown when present.
- An ended listing shows `Sold on <date>`; report it as ended with that date. Hand back `link[rel="canonical"]`, not a pasted URL with tracking parameters.

### When blocked

- Same Akamai tells as the search section: `Access Denied`, the 403 `Error Page | eBay` with `SORRY`, or `Pardon Our Interruption...` at `/splashui/challenge`. A challenge on search in the same session predicts one here, so one item, one navigation, no reload.
- When the item page is challenged, stop and report. Hand your browser to the user for one verification with request_browser_help and open the same URL again, or ask the user for the title, price and time left from their own browser and says the live read did not happen. Never imply a live read succeeded.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.
