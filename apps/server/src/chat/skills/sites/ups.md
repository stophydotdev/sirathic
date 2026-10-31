# Site guide: UPS

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## UPS package tracking

### When to use

The user pastes a UPS tracking number (usually `1Z` plus 16 characters) or a 12-digit InfoNotice door-tag number and asks where the package is. You need that number only. The result is status, estimated or actual delivery date, delivery window, signed-by name, last scan location, and the event timeline. Nothing about the delivery is changed.

### Fastest path

`browser_navigate` to the public tracking URL with `requester=ST/` (trailing slash as in UPS's own emails), which suppresses the My Choice upsell and login modals, then wait 4 seconds for the Angular app to paint.

```
https://www.ups.com/track?loc=en_US&tracknum=<TN>&requester=ST/
https://www.ups.com/track?loc=en_US&tracknum=1Z6Y34W90305161551&requester=ST/
```

### Steps

Track the user's UPS package. Read only, never click My Choice, Change Delivery, Authorize Driver to Leave, or Hold for Pickup.

browser_navigate to https://www.ups.com/track?loc=en_US&tracknum=<TN>&requester=ST/ and wait 4 s, then snapshot (wait 2 s more if the tree is empty).

Classify by the heading. Delivered (read "Delivered On" and "Signed by:"), Out For Delivery (read the time window), On the Way or In Transit (read "Estimated Delivery Date"), Label Created, Delivery Attempted, Returned to Sender, "We could not locate the information" (not found), "Please enter a valid tracking number" (invalid).

Read the activity list (data-spec="activity-list") for every scan, local time, location, description. If the page lists child shipments, report them as a multi-piece master.

If you see "Powered and protected by Akamai" or an "Access Denied" page, wait 8 s and retry once via https://www.ups.com/us/en/home; if it is still blocked, stop and report with the URL.

If a red Tracking Error banner shows instead of a status heading, retry once via https://www.ups.com/us/en/home and the tracking URL; if it shows again, stop and report tracking_error with the URL.

If the page shows a captcha or reCAPTCHA, a sign-in or password prompt, a 2FA code request, or a payment step, stop, do not solve or bypass it, and report which wall appeared and the URL.

Report outcome, service, status, delivery date and window or delivered time, signed by, last location, and the events table.

### Read the result

Read these from the snapshot, or with browser_run_code on the selectors, which in earlier testing were stable across 2024 to 2026 revisions but should be checked against the live page.

- Status banner `[data-spec="header-status-text"]` or `h1.heading-1` inside `<ups-tracking-summary>`.
- Estimated delivery date `[data-spec="delivery-date-text"]`, rendered like `Friday, May 22` with no year. Infer the year and roll forward if the date is more than 14 days in the past.
- Delivery window `[data-spec="delivery-time-text"]`, for example "by 7:00 P.M.".
- Signed by. In the "Proof of Delivery" rail, the label `Signed By:` followed by a span with the surname.
- Last known location. The first item under `[data-spec="activity-list"]`, formatted `{City}, {State} {ZIP}, {Country}`.
- Events. Each `<li>` or `[role="listitem"]` inside `[data-spec="activity-list"]` has a `<time datetime>` when present or text like `{Day-name}, {Month} {DD}, {YYYY} at {HH}:{MM} {AM/PM}`, a location (empty for "Origin Scan" or "Order Processed"), and a description ("Departed from Facility", "Arrived at Facility", "Out For Delivery", "Delivered", "Exception"). Times are local to the scan location, so keep them paired with the location and do not sort by parsed time.
- InfoNotice lookups show status and next attempt date only, never a signed-by name.

### When blocked

- Akamai Bot Manager fronts `www.ups.com/track`, `wwwapps.ups.com/WebTracking/track`, and `m.ups.com/mobile/track/details`. The challenge page has `<div id="sec-if-cpt-container">` and "Powered and protected by Akamai". In earlier testing a plain session never got past it and a stealth browser on a residential proxy was required, and your browser may hit it often. If it shows after the 4 second wait, wait 8 more seconds and snapshot again. If still challenged, navigate to `https://www.ups.com/us/en/home`, wait 2 seconds, and retry the tracking URL once, then stop.
- An "Access Denied" page (HTTP 403 with an Edgesuite reference) is the same Akamai block. One retry through the home page, then stop.
- A red "Tracking Error" banner on a page that otherwise rendered is a UPS-side lookup failure, not an invalid number and not a bot wall.
- One retry through the home page, then report `tracking_error`.
- After any of these take one step, not another attempt: hand the user the tracking deep link to open in their own browser. Do not register for credentials for this job.
- A reCAPTCHA iframe (site key `6LeGXsYiAAAAALO5vceT2N-DmLNfQotjbGM27a8Z`) means the session is flagged. Stop and report it. Do not try to solve it.
- Dead ends. `POST https://webapis.pkginfo.ups.com/track` returns 500 without a warmed cookie jar and CSRF token, `https://www.ups.com/track/api/Track/GetStatus` redirects to `/error.page`, `https://webapis.ups.com/track/api/Track/GetStatus` returns the app shell, and `/track/client/main.*.js` is 403 without a page session. Do not call them with fetch_url.
- A My Choice login wall or sign-in prompt is a stop-and-report wall.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass it. Report which wall appeared and the URL it was on.
