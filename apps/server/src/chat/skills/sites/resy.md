# Site guide: Resy

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## Resy availability

### When to use

The user asks whether a restaurant on Resy has a table for N people on a date or in a window. You need the restaurant (a Resy URL, a slug, or a name and city), the party size, and the date or window. The result is the open slots with time, seating type, and price, plus a deep link, or a sold-out, not-found, ambiguous, not-yet-published, party-too-large, or invite-only outcome. Nothing is booked.

### Fastest path

Resy's web app reads a public JSON API at `https://api.resy.com`. Call it yourself with browser_run_code from a page on `https://resy.com`, so the request carries Resy's own origin, before you read the venue page. Every call needs the header `Authorization: ResyAPI api_key="<key>"`. The key is in Resy's app bundle: on a resy.com page, run this once and use the key it returns.

```js
(async () => {
  const src = [...document.scripts].map((s) => s.src).find((s) => /modules\/app\./.test(s));
  const js = src ? await (await fetch(src)).text() : "";
  return js.match(/apiKey:"([A-Za-z0-9]{30,36})"/)?.[1] ?? "NO_KEY";
})()
```

Then call the API with `fetch(url, { headers: { Authorization: 'ResyAPI api_key="<key>"' } })` inside an async browser_run_code, and return only the fields below, not the whole response.

1. Venue from a URL `https://resy.com/cities/<city>/venues/<slug>`. `GET /3/venue?url_slug=<slug>&location=<code>`, where the code is the city's short code, not the URL's city slug (`new-york-ny` is `ny`): `ny`, `la`, `sf`, `chi`, `mia`, `dc`, `bos`, `lv`, `sea`, `phl`, `atl`, `aus`, `hou`, `dal`, `tor`, `lon`, `nas`, or `den`. Read `id.resy`, `location.latitude`, `location.longitude`, and `max_party_size`.
2. Venue from a name. `POST /3/venuesearch/search` with the JSON body `{"query": "<name>", "geo": {"latitude": <lat>, "longitude": <lon>}}` for the intended city. Take the `search.hits[]` entry whose `name` equals the query, ignoring case, and read `id.resy`, `url_slug`, `_geoloc.lat`, and `_geoloc.lng`. Matches in several cities with no city given are ambiguous. No match is not found.
3. One day. `GET /4/find?lat=<lat>&long=<lon>&day=<YYYY-MM-DD>&party_size=<N>&venue_id=<id>`.
4. A window of up to 30 days. `GET /4/venue/calendar?venue_id=<id>&num_seats=<N>&start_date=<YYYY-MM-DD>&end_date=<YYYY-MM-DD>`, then step 3 for each `scheduled[]` date whose `inventory.reservation` is `available`.

### Steps

Check Resy availability for the restaurant, the party, and the weekday and date. Read only.

Open `https://resy.com/cities/<city>/venues/<slug>?date=<YYYY-MM-DD>&seats=<N>`. Read the venue name and each open time within the window with its seating type, and whether a Notify option shows.

The URL sets the date and party size, so read the times on that page. Use the page's date or party controls only if it shows something else, and only once, setting them with browser_task. Never build other Resy URLs. The times load after the page itself, so wait once for them, then take one snapshot; do not snapshot a loading page again and again. If no time appears, read what the page shows instead, such as a sold-out message or a Notify option. If the tab crashes or goes blank without an error code, open the same URL once more. Access Denied or a bot check will not clear on reload, so stop. On an availability check, do not click a time or Notify. On an availability check, stop as soon as the times are on screen.

### Read the result

`/4/find` returns `results.venues[0].slots[]`. For each slot read `date.start` (the venue's local time), `config.type` (the seating type), and `payment.amount` with `payment.currency`. An empty `slots` list on a 200 means no online table for that day and party, and the calendar says why. A `sold-out` date is sold out. A `closed` date is not bookable online, because the venue is closed that day or has not released it yet, so do not call it sold out. A `notify` block means a waitlist. A party above `max_party_size` gets no slots. The deep link is `https://resy.com/cities/<city>/venues/<slug>?date=<YYYY-MM-DD>&seats=<N>`.

### When blocked

- `/4/find` returns 500. Retry once. Then repeat the venue search from step 2 with `"slot_filter": {"day": "<YYYY-MM-DD>", "party_size": <N>}, "availability": true` added to the body, and read the hit's `availability.slots[]`, which has no price. If that fails too, follow the Steps in the page. When the calendar says `available` and the page shows no times, say the times could not be read, not that the date is sold out.
- A 419 JSON `Unauthorized` means the key is missing, invalid, or rotated. Read it again from the app bundle as above.
- A 419 HTML page from Imperva is a CDN block. Wait 30 seconds, retry once, then follow the Steps in the page.
- A 403 from `/4/find` is an invite-only venue with no signed-out path. Report it.

### Booking

A booking goes out only after the user's yes, as the `restaurant_booking` skill describes, and Resy books only in a signed-in session. Open the deep link with `&time=<HHMM>` added and click the confirmed time. A page that asks for a password, a code, or a card number goes through the sign-in and payment steps in `restaurant_booking`.
