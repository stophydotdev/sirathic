# Site guide: Expedia

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## Compare travel options on Expedia

### When to use

The user wants to shop Expedia inventory the way a traveler would and get a shortlist, not a booking. You need the destination or airports, dates, and party size, plus any caps such as a nightly price. Stays searches return hotels and Vrbo rentals together. Flights searches return round trip totals plus a flexible date price strip.

### Fastest path

Deep link search URLs control most state, so the form is rarely needed. All results load in the browser from `https://www.expedia.com/graphql`, which has no public or cookieless path.

Stays (hotels and Vrbo).

```
https://www.expedia.com/Hotel-Search
  ?destination=<URL-encoded "City, State, Country">
  &regionId=<market id>          # optional but locks the market; e.g. Seattle = 3121
  &startDate=YYYY-MM-DD
  &endDate=YYYY-MM-DD
  &adults=2&rooms=1              # &children=age,age for kids
  &sort=PRICE_LOW_TO_HIGH        # RECOMMENDED | PRICE_LOW_TO_HIGH | REVIEW | DISTANCE | PROPERTY_CLASS
  &price=0,350                   # min,max. TOTAL stay price, not per night
```

Flights.

```
https://www.expedia.com/Flights-Search
  ?leg1=from:City%20(SEA),to:City%20(JFK),departure:MM/DD/YYYYTANYT
  &leg2=from:City%20(JFK),to:City%20(SEA),departure:MM/DD/YYYYTANYT
  &passengers=adults:1
  &trip=roundtrip                 # oneway | roundtrip
  &mode=search
```

Other verticals follow the same load, scroll, read pattern from the top nav (`/Hotels`, `/Flights`, `/Cars`, `/Vacation-Packages`, `/Activities`, `/Cruises`) or the search routes `/carsearch` and `/things-to-do/search`. To find an unknown `regionId`, type the city into the `Where to?` typeahead and read the resolved link, or inspect a returned detail URL.

### Steps

Flights: open `https://www.expedia.com/Flights-Search?leg1=from:<City>%20(<ORIG>),to:<City>%20(<DEST>),departure:<MM/DD/YYYY>TANYT&leg2=from:<City>%20(<DEST>),to:<City>%20(<ORIG>),departure:<MM/DD/YYYY>TANYT&passengers=adults:<N>&trip=<roundtrip|oneway>&mode=search`. For each option read airline, depart, arrive, duration, stops, and the total price. Also read the flexible date strip (date and price pairs).

Stays: open `https://www.expedia.com/Hotel-Search?destination=<City%2C%20State%2C%20Country>&startDate=<YYYY-MM-DD>&endDate=<YYYY-MM-DD>&adults=<N>&rooms=1&sort=PRICE_LOW_TO_HIGH&price=0,<TOTAL_CAP>`. Click "Got it" on the taxes and fees dialog, scroll down 4 times, then read the cards after the "Search results" heading: name, rating, review count, $ nightly, $ total, Fully refundable, badges, detail URL with the h<id>.

Sort by price and keep a 3 item shortlist, with one screenshot of each results page shown with browser_screenshot, show set. Read only. Never click Reserve, Select, or Continue. If a captcha, Akamai block, sign-in or password, 2FA, or payment wall appears, stop.

### Read the result

Stays. Scope to the main list, which begins after the `Search results` heading; each main card is headed `Photo gallery for {name}`. Skip the `VIP Access properties (N)` carousel and sponsored modules above and within the list, which carry their own prices and ratings. Each card has name, guest rating (`9.4 out of 10` plus review count), `$NNN nightly`, `$NNN total`, an optional struck through "was" price, `Fully refundable`, `Reserve now, pay later`, and badges (`VIP Access`, `Member Prices`). The detail link is `/{City}-Hotels-{Name}.h{HOTELID}.Hotel-Information?...` and `h{HOTELID}` is the stable property id. Use the `Property type` filter (`Hotels` vs `Vacation rentals`) to separate hotels from Vrbo.

Flights. Each option shows airline, depart and arrive times, total duration, stop count, and the round trip total for `trip=roundtrip`. A 7 day flexible date strip renders inline (`Fri, Jun 12 $416`); read it to answer "would other dates be cheaper" without searching again.

### When blocked

- Akamai Bot Manager is on every route, and a datacenter session is liable to challenges on `/Hotel-Search` and `/Flights-Search`. A clean bare homepage means nothing for the search routes.
- Member Prices and One Key rates need sign in. Report public pricing and note the "Sign in to unlock Member Prices" prompt. Do not sign in.
- Do not POST to `/graphql`. It uses persisted query hashes, client headers, and valid `bm_*` cookies.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.
