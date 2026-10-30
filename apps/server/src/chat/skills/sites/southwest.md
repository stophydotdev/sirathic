# Site guide: Southwest

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## Southwest Airlines flight search

### When to use

The user wants Southwest fares, which no OTA, meta search, or GDS carries. You need origin and destination IATA codes that Southwest serves, dates, adult and senior counts, and dollars or points. The user gets each itinerary's flight numbers, routing, times, duration, stops, and the four fare columns, or a month grid of cheapest days.

### Fastest path

browser_navigate the deep link. `/air/booking/select.html` 301 redirects to `/air/booking/select-depart.html` with all params unchanged, and the app then forwards to the booking form at `/air/booking/?...&validate=true`, prefilled from the params. Expect the form, not a results grid. Press "Search flights" once and wait for fare rows.

```
https://www.southwest.com/air/booking/select.html
    ?originationAirportCode=DAL
    &destinationAirportCode=LAS
    &departureDate=2026-10-14
    &returnDate=2026-10-17
    &tripType=roundtrip                  // or "oneway" (no &returnDate)
    &adultPassengersCount=1              // 1-8
    &seniorPassengersCount=0             // 65+; counts toward total (max 8)
    &passengerType=ADULT                 // primary passenger pricing class
    &fareType=USD                        // "USD" (dollars) or "POINTS"
    &promoCode=                          // optional, leave empty for none
    &int=HOMEQBOMAIR                     // internal tracking; safe to omit
```

Worked example.

```
https://www.southwest.com/air/booking/select.html?originationAirportCode=DAL&destinationAirportCode=LAS&departureDate=2026-10-14&returnDate=2026-10-17&tripType=roundtrip&adultPassengersCount=1&fareType=USD&passengerType=ADULT
```

Dates are `YYYY-MM-DD`, local to the origin airport. `adult + senior` is at most 8. Send `fareType=USD`, not `DOLLARS`. Children (2 to 11) and lap infants are not URL params and need the form path. Southwest does not sell true multi city; run one ways in sequence.

The fare columns are Choice Extra, Choice Preferred, Choice, and Basic. Wanna Get Away, Anytime, and Business Select no longer appear on the page, so never wait for them.

Low Fare Calendar deep link (trailing slash; `/air/low-fare-calendar.html` returns 404). No dates, the calendar picks its own anchor month. Use it when the form path is unusable or the grid stays empty.

```
https://www.southwest.com/air/low-fare-calendar/?originationAirportCode=DAL&destinationAirportCode=LAS&tripType=roundtrip&adultPassengersCount=1&fareType=USD&passengerType=ADULT
```

Airport resolution when given a city name. The station list is in the JS bundle at `https://www.southwest.com/swa-ui/bootstrap/air-booking-v2/1/data.js`, served as plain JavaScript (about 720 KB). From a southwest.com page, fetch it in browser_run_code and return only the matching records, such as `"emailDisplayName":"Dallas (Love)","cityServed":"Dallas","stationName":"Dallas (Love Field)","id":"DAL"`:

```js
(async () => {
  const js = await (await fetch("/swa-ui/bootstrap/air-booking-v2/1/data.js")).text();
  return js.match(
    /"emailDisplayName":"[^"]*","cityServed":"Dallas[^"]*","stationName":"[^"]*","id":"[A-Z]{3}"/g,
  );
})()
```

Southwest serves DAL, not DFW, and does not serve JFK.

### Steps

Open the deep link. It lands on the prefilled booking form (URL ends in validate=true). Dismiss a cookie banner if one covers the form. Check the form shows the origin, the destination and the dates, then press "Search flights" once. If fare rows render directly instead, skip the form.

Wait until flight rows with dollar or points prices appear (up to 10 s), then snapshot. The fare families are Choice Extra, Choice Preferred, Choice, Basic; read the column order off the page header. There is no "Wanna Get Away" button any more; do not wait for one.

For each outbound row read flight numbers, routing, depart and arrive times, duration, stops, and the four fares (an "Unavailable" cell is sold out). For round trip open the Return tab, snapshot again, and read the return rows the same way.

If the grid stays empty after the wait, reload the page once and wait again. If it is still empty, stop.

Read only. Never click Continue or a fare Select. If you see Access Denied, "There was a problem", a captcha, sign-in or password, 2FA, or payment wall, stop.

### Read the result

Each outbound row exposes. Flight numbers as 4 digit numerics, joined by `/` on connections (`1234 / 5678`). Routing like "DAL → LAS" or "DAL → HOU → LAS". Depart and arrive local times like `6:00 AM`. Aircraft when shown, always `Boeing 737-700`, `Boeing 737-800`, or `Boeing 737 MAX 8`. Total duration `Xh Ym`. Stops as "Nonstop", "1 stop in HOU", "2 stops in HOU, MCO". Layover as `Xh Ym layover in <CITY>`. "On-time performance: 78%" when shown. Four fare columns `Choice Extra` / `Choice Preferred` / `Choice` / `Basic` (read the column order off the page header); in points mode a cell shows points plus `+ $5.60`. A cell rendered "Unavailable" is sold out; a row with fewer than four cells does not offer the missing fare.

Low Fare Calendar. Each day cell renders the lowest fare for an outbound that day (round trip pricing assumes a 3 night return). Read the price and the cell's `data-` attribute or aria label once the first price cell renders.

### When blocked

- Akamai Bot Manager fronts the site, and a session without a residential address can get a generic "There was a problem" page or an Akamai Access Denied page.
- Tells. "Access Denied" with `Reference #18.…`, or a "There was a problem" card after the page renders.
- Retry once, then tell the user Southwest blocked the check, with the reference.
- Landing on the booking form is the normal path, not a block. A block is the form failing to move on after "Search flights", or a results page with no fare rows.
- Empty grid after the wait and one reload. Do not open the deep link again. Open the Low Fare Calendar deep link for the same route and read the cheapest days; if the calendar also stays empty, tell the user Southwest did not render fares. Google Flights can show other airlines on the route, not Southwest's prices.
- All `/api/air-booking/v1/*` and `/api/content/v1/*` routes return Akamai 403 to cookieless calls. Do not call them.
- "We couldn't find any flights" on a route Southwest does not serve means the route is not served, not a block. Check both codes against the station list.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.
