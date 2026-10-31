# Site guide: Google Flights

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## Google Flights cheapest itinerary search

### When to use

The user wants the cheapest one way or round trip fares between two airports on fixed dates, without booking. You need origin and destination IATA codes, the depart date, and the return date for round trips. The user gets the lowest priced itineraries with price, airline, total duration, stops, depart and arrive times, and the results URL as the booking link.

### Fastest path

Build the `tfs` parameter with the script below in browser_run_code, then browser_navigate the results URL. No form filling, no clicks.

`tfs` is a protobuf, base64url encoded (`+` to `-`, `/` to `_`, strip `=` padding), with fields in this wire order.

| Field | Wire type                      | Value                                                                               |
| ----- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `f2`  | varint                         | `0` (seat placeholder)                                                              |
| `f3`  | message, repeated, one per leg | `{ f2: "YYYY-MM-DD" (date), f13: {f1:1, f2:"<ORIGIN>"}, f14: {f1:1, f2:"<DEST>"} }` |
| `f8`  | varint                         | `1` (passengers, 1 adult)                                                           |
| `f9`  | varint                         | `1` (cabin, 1=economy, 2=premium economy, 3=business, 4=first)                      |
| `f19` | varint                         | trip type, `1`=round trip, `2`=one way                                              |

One way is exactly one `f3` leg with `f19=2`. Round trip is two `f3` legs (the second reverses airports and uses the return date) with `f19=1`. `f19` is the trip type field, not `f2`. A single leg with `f19=1` or no `f19` renders round trip fares labeled "round trip".

Fill in `T` and run it in browser_run_code on any page. `ret: null` is one way.

```js
(() => {
  const T = { origin: "SFO", dest: "JFK", depart: "2026-07-15", ret: null };
  const v = (n) => {
    const o = [];
    while (n > 127) {
      o.push((n & 127) | 128);
      n >>>= 7;
    }
    o.push(n);
    return o;
  };
  const tag = (f, w) => v((f << 3) | w);
  const vf = (f, n) => [...tag(f, 0), ...v(n)];
  const mf = (f, b) => [...tag(f, 2), ...v(b.length), ...b];
  const sf = (f, s) => mf(f, [...new TextEncoder().encode(s)]);
  const airport = (c) => [...vf(1, 1), ...sf(2, c)];
  const leg = (d, a, b) => [...sf(2, d), ...mf(13, airport(a)), ...mf(14, airport(b))];
  const p = [
    ...vf(2, 0),
    ...mf(3, leg(T.depart, T.origin, T.dest)),
    ...(T.ret ? mf(3, leg(T.ret, T.dest, T.origin)) : []),
    ...vf(8, 1),
    ...vf(9, 1),
    ...vf(19, T.ret ? 1 : 2),
  ];
  return btoa(String.fromCharCode(...p))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
})()
```

One way SFO to JFK 2026-07-15 gives `EAAaHhIKMjAyNi0wNy0xNWoHCAESA1NGT3IHCAESA0pGS0ABSAGYAQI`.

Results URL. `&curr=USD` forces USD and `&hl=en` forces English. Always append both so the browser's locale does not change currency or language.

Build one `search?tfs=` URL per route and date pair. Never go to the Flights home page to type airports and dates.

```
https://www.google.com/travel/flights/search?tfs=<TFS>&curr=USD&hl=en
https://www.google.com/travel/flights/search?tfs=EAAaHhIKMjAyNi0wNy0xNWoHCAESA1NGT3IHCAESA0pGS0ABSAGYAQI&curr=USD&hl=en
```

### Steps

Open `https://www.google.com/travel/flights/search?tfs=<TFS>&curr=USD&hl=en`. Confirm the title reads "<Origin city> to <Destination city> | Google Flights".

Run `document.querySelector('[role=main]')?.innerText` in browser_run_code and parse every row: depart time, arrive time (+1 = next day), airline, total duration, stops, route, $price. Skip rows without an airline or airport codes, dedupe, and sort by price ascending.

Report the cheapest few as a table with the results URL. Show one screenshot of the results with browser_screenshot, show set. Read only. Do not click Select flight. If a captcha, sign-in, or payment wall appears, stop.

### Read the result

All rows, about 3 KB:

```js
document.querySelector("[role=main]")?.innerText
```

One string per row:

```js
[...document.querySelectorAll("li.pIav2d")].map((li) => li.innerText)
```

Each row reads like `2:35 PM` dash `11:20 PM JetBlue 5 hr 45 min SFO` dash `JFK Nonstop 414 kg CO2e ... $205`, where each dash is an en dash (U+2013) on the page. Multi stop rows add `1 stop` and a connection like `50 min PHX`.

Parse per row. Depart time, arrive time (a trailing `+1` means next day arrival), airline, total duration, stops (`Nonstop` is 0, `N stop` or `N stops` is N), route as two IATA codes joined by U+2013, price `$NNN`.

Rows are duplicated in the DOM, once fully (airline plus airport codes) and once condensed. Skip rows lacking an airline name or airport codes, then dedupe by (depart, arrive, airline, price). The list defaults to Google's "Best" ranking, so sort ascending by price yourself. Flight numbers are not in the list view; they appear only after expanding a row's chevron ("Operated by ... as ... flight NNNN"), which is read only but costs turns. Times are local to each airport and durations already account for the offset. Round trip prices are the total fare.

### When blocked

- Zero priced rows in `[role=main]` under the right title means no flights for the route or date. Report it as a real empty result with the URL.
- If the title does not name the requested cities, the page is not the route you asked for. Recheck the IATA codes and rebuild `tfs`.
- A Google "unusual traffic" or sorry page is a block on your browser's address. Tell the user and send them the results URL, which works in their own browser.
- There is no usable JSON API. The internal `batchexecute` and GRPC endpoints are obfuscated, so do not hunt for one.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass. Report which wall appeared and the URL it was on.
