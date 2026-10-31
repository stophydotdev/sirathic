# Site guide: USPS

Read this before you open this site in your browser. Follow the Fastest path, fill in every URL you know, then follow the Steps.

## USPS package tracking

### When to use

The user pastes a USPS tracking number and asks where the package is or when it arrives. You need the tracking number only. The result is the status text, a status category, expected delivery date, last known location, origin and destination, and the event timeline. Nothing about the shipment is changed.

### Fastest path

`browser_navigate` to the public deep link with the number as digits only, then wait 4 seconds for the Akamai check and render.

```
https://tools.usps.com/go/TrackConfirmAction?tLabels=<NUM>
https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428490
```

### Steps

Track the user's USPS package, tracking number as digits only. Read only.

browser_navigate to https://tools.usps.com/go/TrackConfirmAction?tLabels=<NUM> and wait 4 s, then snapshot.

Read the status heading (e.g. "Delivered, Front Door/Porch", "In Transit to Next Facility") and the "Expected Delivery" text; a trailing * means estimated.

Click the "Tracking History" button, wait 1.5 s, snapshot again, and read up to 30 events (date and time, description, city and state).

If the page shows no tracking heading after 8 s, stop and report an Akamai block with the URL.

If the page shows a captcha, a sign-in or password prompt, a 2FA code request, or a payment step, stop, do not solve or bypass it, and report which wall appeared and the URL.

Never click Add Tracking Plus, Schedule Redelivery, or Hold for Pickup.

Report status, category, expected delivery, last location, origin, destination, and the events table.

### Read the result

- Status is the free-form heading text. Keep it verbatim and also bucket it. `delivered` for "Delivered" (any sub-state). `out_for_delivery` for "Out for Delivery". `in_transit` for "In Transit", "Arrived at", "Departed", "Accepted", "USPS in possession". `pre_shipment` for "Shipping Label Created", "Pre-Shipment", "Awaiting Item". `available_for_pickup` for "Available for Pickup", "Held at Post Office". `alert` for "Delivery Exception", "No Access", "Return to Sender", "Forwarded". `delivery_attempted` for "Delivery Attempted", "Notice Left". Anything else is `in_transit` with the raw text.
- A trailing `*` on the expected delivery date means it is an estimate.
- Not found renders "A status update is not yet available on your package. It will be available when the shipper provides an update or the package is delivered to USPS. Check back soon."

### When blocked

- Akamai Bot Manager fronts `tools.usps.com/go/TrackConfirmAction*` and `m.usps.com/m/TrackConfirmAction*`. A non-browser request gets a 200 with about 220 KB of obfuscated `_abck` challenge JS and `Akamai-Grn` and `X-Akamai-Transformed` headers. In earlier testing a stealth browser on a residential proxy was required and the browser path was never run end to end there, so your browser's address may not clear the challenge, not yet verified. If the page has no tracking heading after 8 seconds, stop and report `blocked` with the URL.
- `TrackConfirmAjaxAction.action` returns 404 (`There is no Action mapped for namespace [/] and action name [TrackConfirmAjaxAction]`). The legacy `https://secure.shippingapis.com/ShippingAPI.dll?API=TrackV2` needs a registered USERID (`80040B1A Authorization failure` otherwise) and is being retired. Do not probe either.
- If the page asks for a password, 2FA code, captcha, or payment, stop. Do not solve or bypass it. Report which wall appeared and the URL it was on.
