# Site guide: Airbnb

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## Airbnb search listings

### When to use

The user wants short term rentals in a place for a date window, filtered by guests, price, place type, bedrooms, amenities, or booking options, or everything inside a map bounding box. You need location, checkin and checkout, and guest counts. The user gets per listing id, title, name, bedrooms, beds, baths, price lines, rating, review count, badges, and the `/rooms/{id}` URL.

### Fastest path

browser_navigate a `/s/{slug}/homes` URL with filters as query params, then read the StaysSearch JSON that the page embeds in `<script id="data-deferred-state-0">` (about 380 KB). Airbnb has no public API and `/api/v3/StaysSearch` uses rotating persisted query hashes plus device fingerprinting, so the embedded JSON is the API.

| Input              | URL                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free form location | `https://www.airbnb.com/s/{slug}/homes?<filters>`, for example `/s/Paris--France/homes` or `/s/Joshua-Tree--CA--United-States/homes`. The slug parser is forgiving and rewrites the canonical slug. |
| Full Airbnb URL    | Use as is and add or override params; Airbnb merges them.                                                                                                                                           |
| Map box only       | `https://www.airbnb.com/s/homes?ne_lat=…&ne_lng=…&sw_lat=…&sw_lng=…&search_by_map=true` plus dates and guests.                                                                                      |
| Listing ids        | `https://www.airbnb.com/rooms/{N}?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&adults=N`. Its JSON is `StaysPdpSections`, a different schema; see the listing page section below.                       |

Always end the slug with `/homes`. Plain `/s/{slug}` sometimes 301s to `/{city}/stays`, which can return a "Stay tuned · Error 503" maintenance page.

Filter params (snake_case in the URL, camelCase in the cache key echo). `checkin`, `checkout` (required for accurate pricing), `flexible_trip_lengths[]=weekend|week|month`, `flexible_date_search_filter_type=0|1|2|3` (exact, ±1, ±3, ±7 days), `adults`, `children` (age 2 to 12), `infants` (under 2), `pets`, `min_bedrooms`, `min_beds`, `min_bathrooms`, `price_min`, `price_max` (storefront currency, total per night including fees by default), `display_currency=USD|EUR|GBP|…`, `room_types[]=Entire%20home%2Fapt|Private%20room|Shared%20room|Hotel%20room`, `property_type_id[]=N`, `amenities[]=N` (undocumented, `4` Wi-Fi, `8` Kitchen), `ib=true` Instant Book, `fc=true` free cancellation, `self_check_in=true`, `allows_pets=true`, `superhost=true`, `accessibility_features[]=N`, `host_languages[]={iso-2}`, `category_tag=Tag:NNNN` (`Tag:8536` is Amazing views), `ne_lat`, `ne_lng`, `sw_lat`, `sw_lng`, `search_by_map=true`, `items_offset=N` (0, 18, 36, ...), `section_offset=0`, `pagination_search=true`, `query=`, `refinement_paths[]=%2Fhomes`. Unknown params are dropped silently. Discover enum values by clicking the control in the Filters modal once and reading the param it appends to the URL.

Worked example.

```
https://www.airbnb.com/s/Paris--France/homes?checkin=2026-06-15&checkout=2026-06-20&adults=2&min_bedrooms=2&price_min=100&price_max=500&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=4&ib=true&superhost=true
```

### Steps

Open `https://www.airbnb.com/s/<City>--<Country>/homes?checkin=<YYYY-MM-DD>&checkout=<YYYY-MM-DD>&adults=<N>&min_bedrooms=<N>&price_min=<N>&price_max=<N>&room_types%5B%5D=Entire%20home%2Fapt` (add ib=true, fc=true, superhost=true as needed). Ignore the "one price for your trip" dialog. Run this in browser_run_code:

```js
(() => {
  const s = document.getElementById("data-deferred-state-0");
  if (!s) return { error: "NO_SSR" };
  const d = JSON.parse(s.textContent).niobeClientData[0];
  const r = d[1].data.presentation.staysSearch.results;
  return {
    cacheKey: d[0],
    pageTitle:
      r.sectionConfiguration?.pageTitleSections?.sections?.[0]?.sectionData?.structuredTitle,
    results: r.searchResults.map((x) => ({
      id: atob(x.demandStayListing?.id ?? "").replace("DemandStayListing:", ""),
      title: x.title,
      name: x.subtitle,
      lines: x.structuredContent?.primaryLine?.map((l) => l.body),
      price: x.structuredDisplayPrice?.primaryLine,
      details: x.structuredDisplayPrice?.explanationData?.priceDetails,
      rating: x.avgRatingLocalized,
      badges: x.badges?.map((b) => b.loggingContext?.badgeType),
      payment: x.paymentMessages,
    })),
  };
})()
```

Sort by price, with URLs as `https://www.airbnb.com/rooms/<id>`. Read only. Never click Reserve, Save, or Sign In. If the script returns NO_SSR, or a 429, a 503 Stay tuned page, captcha, sign-in or password, 2FA, or payment wall appears, stop and do not reload.

### Read the result

The script's `cacheKey` is `"StaysSearch:" + JSON.stringify({...})` and echoes every filter Airbnb honored, camelCased. Read it to confirm a filter was accepted.

| Field                     | Source                                                                                                                    | Note                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `id`                      | `demandStayListing.id`, base64 decoded, `DemandStayListing:` prefix stripped                                              | `propertyId` is null, ignore it                                    |
| `url`                     | `https://www.airbnb.com/rooms/{id}`                                                                                       |                                                                    |
| `title`                   | `title`                                                                                                                   | Property type plus neighborhood                                    |
| `name`                    | `subtitle`                                                                                                                | Host supplied listing name                                         |
| bedrooms, beds, bathrooms | `lines`, the `structuredContent.primaryLine[]` bodies                                                                     | Studios show `"1 sofa bed"` with no bedroom row                    |
| nightly price             | `price.price` when `__typename` is `QualifiedDisplayPriceLine`, `price.discountedPrice` when `DiscountedDisplayPriceLine` | Currency formatted string                                          |
| original price            | `price.originalPrice`                                                                                                     | Only on `DiscountedDisplayPriceLine`                               |
| qualifier                 | `price.qualifier` ("for 5 nights"), `price.accessibilityLabel`                                                            |                                                                    |
| total before taxes        | `details[].items[]`, the `HighlightExplanationLineItem` with description "Price after discount" or "Total before taxes"   | Breakdown also holds cleaning fee, service fee, long stay discount |
| rating, review count      | parse `rating` ("4.85 (132)")                                                                                             | null for new listings                                              |
| badges                    | `badges`                                                                                                                  | `GUEST_FAVORITE`, `TOP_TIER_FAVORITE`, `SUPERHOST`, `NEW_LISTING`  |
| payment messages          | `payment`                                                                                                                 | Strings like "Free cancellation"                                   |
| max guests, host name     | Not in the search payload                                                                                                 | Listing page only                                                  |

Totals. `pageTitle` reads "60 homes in Lisbon" and is fuzzed past about 270 to "Over 1,000 homes in Paris".

### When blocked

- PerimeterX. A bare session can get a PerimeterX HTML shell with no `#data-deferred-state-0` script; the script's `NO_SSR` is the tell.
- HTTP 429, or the "Stay tuned" Error 503 page on a URL that already ends in `/homes`, is Airbnb's rate limit on repeated requests in one session; it clears after a 45 s wait.
- Back off at least 45 s, do not refresh, and make at most one more navigation. If that fails too, do not open Airbnb again: move to the property's own site or another rentals site, or hand the user a prebuilt `/s/{slug}/homes` URL, and say Airbnb rate limited the search.
- "Stay tuned · Error 503" with a URL that lacks `/homes` is the redirect problem. Retry once with the `/s/{slug}/homes` form.
- Do not call `/api/v3/StaysSearch` directly.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.

## Airbnb listing page

### When to use

The user has a room id or a pasted `/rooms/{id}` URL and wants one listing's details for a date window: layout, capacity, rating, the price for those dates, and the cancellation terms. You need the id plus checkin, checkout, and guest count. Read only.

### Fastest path

Navigate `https://www.airbnb.com/rooms/{id}?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&adults=N&display_currency=USD`. The page embeds a `StaysPdpSections` JSON in `<script id="data-deferred-state-0">` at `niobeClientData[0][1].data.presentation.stayProductDetailPage.sections`. Its `metadata` holds the title line, capacity, ratings, and coordinates, and the cache key at `niobeClientData[0][0]` echoes the `dateRange` the page priced.

The price lines, fees, amenities, house rules, and cancellation policy are null in the JSON and render on the page, so read them as page text. Read one listing at a time with a pause between them; several listings in a row run into the rate limit in the search section.

### Steps

Open `https://www.airbnb.com/rooms/<id>?check_in=<YYYY-MM-DD>&check_out=<YYYY-MM-DD>&adults=<N>&display_currency=<USD|EUR|GBP>`. Ignore the "one price for your trip" dialog if it appears. Run this in browser_run_code:

```js
(() => {
  const n = document.getElementById("data-deferred-state-0");
  if (!n) return { error: "NO_SSR" };
  const d = JSON.parse(n.textContent).niobeClientData[0];
  const s = d[1].data.presentation.stayProductDetailPage.sections;
  return {
    cacheKey: d[0],
    share: s.metadata.sharingConfig,
    log: s.metadata.loggingContext.eventDataLogging,
    cap: s.sections.find((x) => x.sectionId === "BOOK_IT_SIDEBAR")?.section?.maxGuestCapacity,
  };
})()
```

From share take title, propertyType, personCapacity, starRating, reviewCount. From log take listingId, roomType, isSuperhost, guestSatisfactionOverall and the six sub ratings.

Then read the rendered page once: the booking sidebar's nightly price, nights, cleaning fee, service fee and total before taxes for the dates in the URL, and the sleeping arrangement, amenities, house rules and cancellation policy as page text. A field the page does not show is unreadable, never a guess.

Read only. Never click Reserve, Save, or Sign In, and do not change the dates. If the script returns NO_SSR, or a 429, a 503 Stay tuned page, captcha, sign-in or password, 2FA, or payment wall appears, stop and do not reload.

### Read the result

- `sharingConfig.title` is one string with property type, rating, bedrooms, beds, and baths. `eventDataLogging` carries `listingId`, `roomType`, `isSuperhost`, and the six sub ratings.
- The cache key's `dateRange` confirms the dates in the URL were honored. A price you can't read means the sidebar had not rendered one; do not fill it from the search card.

### When blocked

- No `#data-deferred-state-0` script is the PerimeterX tell from the search section.
- HTTP 429 or the "Stay tuned" Error 503 page follows the search section's rate limit rule, handing the user the dated `/rooms/{id}` URL at the end.
- A sidebar with no price for the dates means no price for those dates.
- A new date window is a new lookup.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.
