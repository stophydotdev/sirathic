# Site guide: United

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## United Airlines flight search

### When to use

The user wants United's published cash fares and schedules for a route and date without committing to a booking. You need origin and destination IATA codes, depart date, return date for round trips, passenger count, and cabin. The user gets each outbound flight's times, duration, stops, flight numbers, fare brand, and all in price. Multi-carrier or multi-date fare shopping belongs in the `google_flights` guide. MileagePlus award searches have their own section below; do not read award prices off the cash page.

### Fastest path

browser_navigate the results deep link. It skips the homepage typeahead, date picker, and trip type radio. The page is a React SPA with zero embedded flight data, so the browser must render it.

```
https://www.united.com/en/us/fsr/choose-flights
  ?f={ORIGIN_IATA}
  &t={DEST_IATA}
  &d={DEPART_YYYY-MM-DD}
  &r={RETURN_YYYY-MM-DD}          # omit for one-way
  &tt={1|0|2}                      # 1=round-trip, 0=one-way, 2=multi-city
  &sc=7                            # search-class, keep 7 for cash fares
  &px={PASSENGER_COUNT}            # integer, 1 to 9
  &taxng=1                         # show all-in (taxes included) pricing
  &clm=7                           # cabin: 7=Economy, 6=Premium Economy, 4=Business, 3=First
  &st=bestmatches                  # bestmatches | priceasc | departtime | arrivetime | duration
  &newDateOverride=true            # use new date logic, safer on cross-month dates
```

Examples.

```
https://www.united.com/en/us/fsr/choose-flights?f=SFO&t=JFK&d=2026-07-15&r=2026-07-22&tt=1&sc=7&px=1&taxng=1&clm=7&st=bestmatches
https://www.united.com/en/us/fsr/choose-flights?f=SFO&t=JFK&d=2026-07-15&tt=0&sc=7&px=1&taxng=1&clm=7&st=bestmatches
```

Airports are IATA codes only. City names get coerced to a "no flights" state, so resolve them to codes first. Dates must be `YYYY-MM-DD`, not in the past, and within United's 11 month window. Optional `noflex=true` disables the flexible date calendar above the grid. `tt=2` needs a different `f1`/`t1`/`d1` layout and is out of scope.

### Steps

Open the deep link with `st=priceasc`. Wait for the flight cards, then snapshot. If no flight cards, wait 2 s and snapshot once more.

For each outbound card read depart time, arrive time (+1d = next day), duration, stops, flight numbers (UA nnn), fare brand, and the all-in USD price (strip a trailing * and note saver).

If you see "No flights available for the dates you selected", that is an empty result. If the date picker reopens, the date was rejected. If the header city is wrong, the IATA code was not recognized. If an error banner renders where the flight cards should be, that is a site error banner; stop.

Read only. Never click Select, Continue, or a fare price. If a captcha, Akamai 403, sign-in or password, 2FA, or payment wall appears, stop.

### Read the result

Each card exposes, in snapshot text order. Depart time (first time string, `08:30`, local airport time), arrive time (second time string), duration like `5h 35m` or `5h 35m +1d` for next day arrival, stop count `Nonstop`, `1 stop`, `2 stops`, flight numbers like `UA 232` or `UA 232, UA 7411` on multi leg, fare options Basic Economy / Economy / Premium Plus / Business / First with one price each, and the price as a USD number. A `*` on a price (`$348.20*`) marks a Saver or mixed cabin fare; strip it and say it is a saver fare. Take the lowest cabin price unless `clm` asked for a higher cabin.

Round trip pages render outbound cards only. Return cards render after selecting an outbound, which a lookup must not click. For return leg pricing run a second one way search with `f` and `t` swapped and `d=<return date>`.

### When blocked

- Akamai fronts every path, and a datacenter address may be challenged on the second navigation.
- Tells. A captcha or "verify you are a human" page, or an Akamai 403.
- Site error banner. The fsr deep link sometimes renders an error banner ("unable to complete your request") instead of flight cards. Do not open the deep link again; take the route to the `google_flights` guide and read United's rows there.
- No out of band JSON path. Do not reverse engineer `searchFsr` or other United APIs; the browser is the only way in.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.

## United award search

### When to use

The user wants MileagePlus award pricing (miles plus a cash copay) for a route and date. Awards live on `/ual/en/us/flight-search/book-a-flight/results`, not the fsr cash page, and may sit behind a MileagePlus sign-in. Do not build award URL parameters; this section stops at the wall.

### Fastest path

Start at the award results path with no query parameters. Expect a MileagePlus sign-in wall, an award search form, or the results. On the wall, decide: sign in through the browser skill's Sign-ins and private details steps and do the same steps again, or give cash fares from the section above with a note that award pricing needs the user's sign-in.

### Steps

Open `https://www.united.com/ual/en/us/flight-search/book-a-flight/results` (no parameters; do not add award parameters). Snapshot once it loads. If a MileagePlus sign-in form or a sign-in prompt blocks the page, stop. Do not type a username or password yourself.

If a search form renders instead, fill the origin, the destination, the depart date, the return date or none, and the adults, choose the miles or award option, submit once, and snapshot.

For each outbound card read depart time, arrive time (+1d = next day), duration, stops, flight numbers (UA nnn), cabin, miles, and the cash copay. Note a saver or waitlist mark. If the page says no award seats are available, that is an empty result.

Read only. Never click Select or Continue. If a captcha, Akamai 403, password, 2FA, or payment wall appears, stop.

### Read the result

Report miles and cash copay side by side per cabin, with flight numbers and stops read as in the cash section, and mark saver or waitlist fares. If the page rendered only after sign-in, say the prices are for that account.

### When blocked

- A sign-in wall is the expected first outcome when your browser is signed out.
- Do not open the same URL again. A user-pasted award results URL is opened as is, with the same stop rules.
- Same Akamai tells and rules as the cash section. If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.
