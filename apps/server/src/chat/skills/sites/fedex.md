# Site guide: FedEx

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## FedEx package tracking

### When to use

The user pastes a FedEx tracking number and asks where the package is, when it arrives, or who signed for it. You need the tracking number only. The result is current status, last known location, scheduled or estimated delivery window, service type, signed-by name, and the scan events. Nothing about the shipment is changed.

### Fastest path

`browser_navigate` to the tracking deep link and wait 4 seconds, since the tracking detail is a JS app that renders 1 to 3 seconds after load.

```
https://www.fedex.com/fedextrack/?trknbr={NUMBER}
https://www.fedex.com/fedextrack/?trknbr=394002115586
```

Use `trknbr=`, not `trackingnumber=`, which can bounce through the landing page. Put one number in each URL. Comma-joined batches (`trknbr=A,B,C`) can land on a system-error page, so look several numbers up one after another.

### Steps

Track the user's FedEx package. Read only, never schedule, hold, redirect, or enter an address.

browser_navigate to https://www.fedex.com/fedextrack/?trknbr=<NUMBER>, wait 4 s, then check the URL. /detailedtracking is a single shipment, /multitrkidsummary lists several, /multitrkidnotfound or /no-results-found is not found, /duplicate-results needs a trkqual, /guestAuthentication or /howtoproceed is a private shipment (stop and report).

One number per URL; for several numbers repeat these steps for each, never comma-join them.

If the URL lands on /system-error, wait 5 s and navigate to the same URL once more; if it lands there again, stop and report system_error with the URL and the page text.

Snapshot and read the status heading (Delivered, On the way, Pending), the service line, the Scheduled delivery or Delivered row, and "Signed for by:".

Click "Travel history", snapshot, and read every scan event (timestamp, location, description).

If you see Access Denied or only an empty shell after the wait, stop and report the Akamai wall with the URL.

If the page shows a captcha, a sign-in or password prompt, a 2FA code request, a ZIP verification, or a payment step, stop, do not solve or bypass it, and report which wall appeared and the URL.

Report status, service, last location, delivery window or actual delivery, signed by, and events oldest first.

### Read the result

- Status heading, service line, delivery row, "Signed for by:" value, and the travel history rows with timestamp, location, description, newest first.
- Data is purged after about 18 months.

### When blocked

- Every fedex.com page is behind Akamai (cookies `_abck`, `ak_bmsc`, `bm_mi`, `bm_sz`, `fdx_cbid`, `fdx_bman`). In earlier testing a plain session got an Access Denied HTML page and a stealth browser on a residential proxy was required, so your browser's address may hit the same wall, not yet verified. If the page shows Access Denied or still shows only the empty shell after the wait, stop and report the wall and URL.
- A label the shipper created recently returns not found or a system-error page until the first carrier scan.
- When the shipper's email shows no pickup or drop-off scan yet, report `pre_transit_unscanned`, not `not_found`, take the ship date and expected delivery from that email, and do not look it up again in the same turn. A system-error page that persists after the one retry on a number already scanned is a FedEx-side failure: report `system_error` and use the shipper's email.
- The internal `/trackingCal/track` XHR is bound to those cookies and returns 403 or "FedEx Page Not Found" without them. Do not call it with fetch_url.
- 16-character numbers are Delivery Manager confirmation codes and redirect to a different flow. Standard numbers are 12, 15, or 22 digits.
- A sign-in or ZIP verification prompt is the private-shipment wall. Stop and report.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass it. Report which wall appeared and the URL it was on.
