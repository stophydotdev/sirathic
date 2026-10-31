# Site guide: Facebook Marketplace

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## Facebook Marketplace search

### When to use

The user wants Marketplace listings for a query in a metro ("used Peloton under $500 within 20 miles of Austin, listed this week"), a category browse, or the details behind a `/marketplace/item/<id>/` link. You need the query and the metro; ZIPs and free text city names do not work in the URL, only Facebook's city slug. The user gets id, title, price, city and state, thumbnail, delivery types, and item URL per listing, plus seller, description, photos, and posted time for a single item. Read only.

### Fastest path

`browser_navigate` to the search URL. The first page of results is server rendered as JSON in the HTML, so one navigation gives about 15 listings in earlier testing (24 on 2026-09-10). There is no public Marketplace API, and `/api/graphql/` needs session bound `fb_dtsg`, `lsd`, and `jazoest` tokens, so there is no plain HTTP path.

Preflight. A browser with no Facebook session usually gets the logged out splash on page one (`login_required_on_first_page`). Before you search, check for a signed-in Facebook session in your browser, from a sign-in earlier in this conversation. With no session, either sign in first with the browser skill's Sign-ins and private details steps, or skip Marketplace and use the classifieds alternates the user's request allows, such as Craigslist or eBay. When the page shows `login_required_on_first_page`, do not search logged out again: sign in as above and search once more, or move to those alternates in the same turn.

```
https://www.facebook.com/marketplace/<slug>/search/?query=<urlenc-query>
```

Known good slugs in earlier testing are `nyc`, `la`, `sanfrancisco`, `chicago`, `austin`, `boston`, `seattle`, `atlanta`, `miami`, `portland`. Variants such as `newyork`, `losangeles`, `bayarea`, `sf`, `san-francisco`, `new-york`, a ZIP, or a numeric id all 302 to `/marketplace/category/search/`, which drops the location and falls back to your browser IP's geo. For an unknown metro open `https://www.facebook.com/marketplace/`, use the location picker, and read the segment after `/marketplace/` in the resulting URL. For a category browse use `?category=<top-level>` or `/marketplace/<slug>/<top-level-category>`.

| Filter | Param | Values |
|---|---|---|
| Price | `minPrice`, `maxPrice` | integer, local currency |
| Days since listed | `daysSinceListed` | `1`, `7`, `30` |
| Condition | `itemCondition` | comma list of `new`, `used_like_new`, `used_good`, `used_fair` |
| Availability | `availability` | `in stock` (default), `out of stock`, `all` |
| Delivery | `deliveryMethod` | `local_pick_up`, `shipping`, omit for both |
| Radius (miles) | `radius` | `1`, `2`, `5`, `10`, `20`, `40`, `60`, `80`, `100`, `250`, `500`, default 40 |
| Sort | `sortBy` | `creation_time_descend`, `distance_ascend`, `price_ascend`, `price_descend`, omit for best match |
| Exact match | `exact` | `true`, `false` (default) |
| Category | `category` | `vehicles`, `propertyrentals`, `apparel`, `electronics`, `family`, `free`, `garden`, `hobbies`, `home`, `homeimprovement`, `musicalinstruments`, `officesupplies`, `petsupplies`, `sportinggoods`, `toys`, `bookmoviesmusic` |
| Vehicles | `make`, `model` | free text, case insensitive |
| Vehicles | `carType` | `sedan`, `coupe`, `hatchback`, `suv`, `truck`, `van`, `convertible`, `wagon`, `minivan`, `other` |
| Vehicles | `transmissionType` | `automatic`, `manual` |
| Vehicles | `minYear`, `maxYear`, `minMileage`, `maxMileage` | 4 digit year, integer miles |
| Vehicles | `vehicleExteriorColors`, `vehicleInteriorColors` | `black`, `white`, `silver`, `gray`, `red`, `blue`, `green`, `brown`, `tan`, `gold`, `orange`, `purple`, `yellow`, `other` |
| Vehicles | `titleStatus` | `clean`, `salvage`, `rebuilt`, `other` |
| Rentals | `minBedrooms`, `maxBedrooms`, `minBathrooms`, `maxBathrooms` | integer, `.5` for half baths |
| Rentals | `minAreaSize`, `maxAreaSize` | sqft |
| Rentals | `propertyType` | `apartment_condo`, `house`, `room`, `townhouse`, `mobile_manufactured`, `other` |
| Rentals | `privateRoomBathroomType` | `attached`, `not_attached`, `shared` |

Do not encode the commas in multi value params. Unknown params are silently dropped; confirm acceptance from the `params` echo in the HTML. Worked example.

```
https://www.facebook.com/marketplace/austin/search/?query=peloton&minPrice=100&maxPrice=500&daysSinceListed=7&radius=20&sortBy=creation_time_descend
```

### Steps

Search Facebook Marketplace in the metro slug (one of nyc, la, sanfrancisco, chicago, austin, boston, seattle, atlanta, miami, portland) for the user's query and filters. Read only, never click Message, Make Offer, Save, Share, or Report.

Open https://www.facebook.com/marketplace/<slug>/search/?query=<url-encoded query><&minPrice=<n>&maxPrice=<n>><&daysSinceListed=1|7|30><&radius=<mi>><&sortBy=creation_time_descend|distance_ascend|price_ascend|price_descend><&category=<top-level-category>>. Wait 2 s.

If the URL changed to /marketplace/category/search/, stop and report location_resolution_failed. If it changed to /marketplace/ineligible/, stop and report page_profile_ineligible.

Run `(() => { const h = document.documentElement.outerHTML; const m = h.match(/"marketplace_search":\{"feed_units":\{"edges":\[(.+?)\],"page_info":\{(.+?)\}\}/s); const p = h.indexOf('"params":{'); return { edges: m ? JSON.parse('[' + m[1] + ']') : null, page_info: m ? JSON.parse('{' + m[2] + '}') : null, location_id: p === -1 ? null : (h.slice(p).match(/"location_id":"([^"]*)"/) ?? [])[1] ?? null }; })()` in browser_run_code, which parses the marketplace_search edges from the page HTML; confirm its location_id equals the slug.

For each node.listing report id, marketplace_listing_title, listing_price.formatted_amount, location.reverse_geocode.city and state, delivery_types, is_sold, is_pending, primary_listing_photo.image.uri, and https://www.facebook.com/marketplace/item/<id>/.

If more are wanted, scroll down, wait 1.5 s, and read div[role="article"] cards with /marketplace/item/<id>/ links, up to the number of scrolls the user's request needs. If a "Log in or sign up" wall appears, stop scrolling and report partial results.

### Read the result

Search edges are `{ node: { listing: {...}, story_key } }`. Fields per `node.listing`.

```
id                                             canonical listing id, matches /marketplace/item/<id>/
marketplace_listing_title
listing_price.formatted_amount                 "$200"
listing_price.amount                           "200.00"
listing_price.amount_with_offset_in_currency   "20000" minor units
location.reverse_geocode.city / .state / .city_page.id / .city_page.display_name
primary_listing_photo.image.uri                526x395 thumbnail
marketplace_listing_category_id                numeric leaf category, no public name map
delivery_types                                 subset of ["IN_PERSON", "DOOR_PICKUP", "SHIPPING"]
is_live | is_sold | is_pending | is_hidden | is_viewer_seller
strikethrough_price                            original price if discounted
custom_sub_titles_with_rendering_flags         [{"subtitle":"19K miles"}] for vehicles
```

Lat/lon, description, seller, full photos, condition, and posted time are not in search results. The item page's `marketplace_listing_renderable` adds `description` or `redacted_description`, `listing_photos[].image.uri`, `marketplace_listing_seller.name` and `.id` (profile `https://www.facebook.com/<seller.id>/`), `creation_time` (epoch seconds), `location_text`, `location.latitude`, `location.longitude`, `condition_description`, `custom_attributes` (vehicle VIN, fuel_type, title_status, transmission, body_style, exterior_color, interior_color; apparel size, brand; rental bedrooms, bathrooms, area_size, property_type), and the full `delivery_types`. In earlier testing the item page payload was inferred from schema references, not read end to end. In earlier testing `radius=20` echoed `filter_radius_km: 32`; on 2026-09-10 it echoed `filter_radius_km: 20`, so read the unit from the echo. Search `delivery_types` may omit `SHIPPING`. Photo URLs on `scontent-*.xx.fbcdn.net` are signed and expire (`oe=` param). Never include `node.tracking` in the output.

### When blocked

- In earlier testing a plain cloud session got a logged out splash or an empty `marketplace_search` and a stealth residential session was needed. Your browser hits the same wall without a Facebook session, and changing the URL does not help.
- The user's own Chrome profile may already be signed in to Facebook, which in earlier testing is what deep pagination needs.
- Login wall. After about 5 to 10 scroll pages without auth Facebook inserts "Log in or sign up for Facebook to connect with friends, family and people you know". Detect that text or `/log in to (see more|continue)/i`. Do not use the `"login_form"` substring as the tell; it is present in the HTML of a normally served signed out results page (observed 2026-09-10, with 24 listings parsed from the same HTML). Return what was extracted with `partial: true` and the page count. Do not dismiss it, register, or scroll past.
- A login wall on page one means Facebook served the logged out splash. The tell is zero `marketplace_search` edges together with that text. Stop and report `login_required_on_first_page`.
- Do not search Marketplace again in that session. Either get a session as in the preflight and search once more after the session is confirmed, or move to the classifieds alternates, in the same turn.
- A redirect to `/marketplace/ineligible/` or a notice that Pages cannot use Marketplace means your browser's Facebook session is acting as a Page.
- Stop and report `page_profile_ineligible`; ask the user to switch that session to their personal profile, then search once more.
- "Marketplace isn't available" means the region is unsupported. Report `region_unavailable`.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.
