# Site guide: OpenTable

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## OpenTable availability

### When to use

The user wants open tables on OpenTable for a party size, a date, and a time or window, at a named restaurant or for a cuisine in an area. You need the party size, the date, the time, and either the restaurant's OpenTable page or a search term with the neighborhood and city. The result is the open times near the requested time with their seating labels, and any deposit or card notice, or a sold-out or not-bookable outcome. Nothing is booked.

### Fastest path

The browser is the path. OpenTable's JSON endpoints sit behind a bot wall, so do not call them.

Open a URL that already carries the party size and time, so you read times instead of working the pickers.

- A named restaurant. Find its page with search_web for the name, city, and "OpenTable", which usually returns `https://www.opentable.com/r/<slug>`. Open `https://www.opentable.com/r/<slug>?covers=<N>&dateTime=<YYYY-MM-DD>T<HH:MM>:00`.
- A cuisine or area. Open `https://www.opentable.com/s?covers=<N>&dateTime=<YYYY-MM-DD>T<HH:MM>:00&term=<cuisine neighborhood city>`.

### Steps

Check OpenTable availability for the restaurant, or the cuisine in the neighborhood and city, for the party, the weekday and date, and the time. Read only.

Open the restaurant page or search URL. Read each restaurant's name, its open times within the window of the requested time with any seating or experience label, any deposit or card notice the page already shows, and the page URL. At most five restaurants.

The URL sets the party size and time, so read the times on that page. Use the page's date, time, or party controls only if those controls show something else, and only once. The time buttons' hidden labels can name a different party size, so trust the party control. A search covers the whole city even when the term names a neighborhood, so choose results by the neighborhood on each card. Never build other OpenTable URLs. If the tab crashes or goes blank without an error code, open the same URL once more. If the times are still loading, wait once, then take one snapshot; do not snapshot a loading page again and again. Access Denied, a challenge page, or a blocked response will not clear on reload, so stop. On an availability check, never click a time, because that holds the table. Before completing a booking, check that the details page shows the requested party size. If the requested time is gone, read the nearest open times on that page. On an availability check, stop as soon as the requested date's times are on screen.

### Read the result

Times are the restaurant's local time. A time with a marker or an experience name is a special seating that is often prepaid. A no-online-availability message or a notify option means nothing is bookable online at that time.

Offer the times you saw, an adjacent day, or the restaurant's phone line, as the `restaurant_booking` skill describes.

### When blocked

Access Denied or a blocked response from OpenTable does not clear on reload. Tell the user OpenTable blocked the check and send them the restaurant page URL. A timeout or a crashed tab is a slow page, not a block, so do not report it as one.

### Booking

A booking goes out only after the user's yes, as the `restaurant_booking` skill describes. Your browser may already be signed in to OpenTable, so open the page before asking for a sign-in. Open the restaurant URL with the confirmed date, time, and party, click the confirmed time, and fill only the guest details you have. A page that asks for a password, a code, or a card number goes through the sign-in and payment steps in `restaurant_booking`. Read the confirmation number from the confirmation page.
