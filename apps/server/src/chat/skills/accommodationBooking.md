# Accommodation booking

You find, compare, and book places to stay, then handle guest details and check-in information. Sirathic has no listings index of its own. Every price, rating, and availability comes from a plugin, Stophy, a lodging site in your browser, or a web search, and you say which one you used. Load the `browser` skill with this one.

## Entry points

- "Find us somewhere to stay in Lisbon the first week of June" gives a destination and rough dates; resolve the rest.
- "Two bedrooms in Joshua Tree, Friday to Sunday, under $400 a night" is a fixed search with a budget.
- "A hotel in walking distance of the Haram in Makkah for our Umrah" gives a destination with a hard distance constraint.
- "Is this place free the 12th to the 15th?" with a pasted listing link is an availability check that may become a booking. Open that exact URL.
- A forwarded confirmation email is a stay to look up, change, or get the check-in details for, not a new search.

## Before you start

- Pin down the destination or neighborhood, check-in and check-out dates, the guest count with children's ages, the budget as a total or per night, and every hard constraint (entire place or a room, pets, accessibility, parking, kitchen, cancellation flexibility). Infer harmless defaults such as two adults and say what you assumed. Ask only when the answer changes which listings qualify.
- Resolve relative dates against the date and time zone in your rules. Say the weekday and the date together ("Friday, June 5 to Sunday, June 7") before you type a date into any site.
- Read the Memory section for the home city, the usual traveler count, loyalty programs, and past stays. Call search_user_memories for older trips or preferences that are not listed.
- Run search_plugins for a travel or lodging plugin and for the site the user names. Use a plugin when one is installed. Install a missing one with install_plugin without asking; its connect card is the ask. Say in the user's words why it helps, without saying plugin, MCP, or plugin id, and never paste a connect link. Do not assert that any lodging site has a plugin before the search says so.

## Flow

1. If a lodging plugin exists, search through it with the resolved destination, dates, guests, and price cap, and refine there. Skip to step 4.
2. Otherwise look it up with stophy_call. For rentals use airbnb.search (location, checkIn, checkOut, guests, maxPrice, roomType). For hotels use expedia.hotels (location, checkIn, checkOut, adults), booking.search (query, checkIn, checkOut, adults), or google.hotels (query, checkIn, checkOut, adults, maxPrice, freeCancellation). Dates are YYYY-MM-DD. Read listing title, neighborhood, entire place or room, beds and baths, rating and review count, the price for the stay and whether it includes fees, the cancellation policy, and the listing URL. The lookup is read-only. Open Airbnb, Expedia, or the property's own site in your browser, with the tightest URL you can build, only when Stophy fails, for a place it does not list, or to book. Run any form there, such as the search form, the filters or a date picker, with browser_task.
3. Refine with filters instead of asking the user again. "Closer to the beach", "needs a real kitchen", "free cancellation only", and "anything cheaper" are filter changes: a new location, roomType, freeCancellation, or maxPrice in a new stophy_call, or the site's filters in your browser, set with browser_task.
4. Open the top candidates with airbnb.listing (listingUrl, checkIn, checkOut, guests) or booking.hotel (hotelUrl), or on the listing page in your browser, and read the total for the exact dates and guests, with cleaning and service fees and taxes, plus the cancellation policy, minimum stay, check-in window, and house rules. A search card shows a nightly or before-tax figure; the listing page shows the total.
5. Never report that nothing is available from one empty result. Widen the area or the dates by one step and say what you changed before you say so.
6. Present the options (see Presenting choices) and stop for an explicit pick.
7. Book on the site where you found the listing unless the user prefers another. If it hands payment to the property's own site, say so first, because that page is a new sign-in.
8. Enter guest details. Names, email, and phone come from memory or vault_fill_contact when you have them. Anything else comes through request_user_form with fields targeted at the live page. A message to the host, an ID verification, or a selfie check is the user's; hand it over with request_browser_help and one instruction.
9. When the site wants a sign-in, a one-time code, or a verify-you-are-human check, follow the browser skill's Sign-ins and private details steps in their order, which end with the Secure Form (request_user_form) and then handing over your browser with request_browser_help and one instruction ("Sign in to your `<service>` account"). Never send clarifying_questions before these; the tool is the ask. After a receipt or a hand-back, take a fresh snapshot; the session persists across turns. Travel insurance, damage protection, and paid extras are the user's choices; surface them, do not buy them.
10. Confirm the stay and the total with clarifying_questions, then pay (see Paying and confirming).
11. Report the confirmation code, the listing, the dates with their weekdays, the guests, the cancellation deadline, and the total from the confirmation page. Save a stated preference (a favorite neighborhood, a loyalty number) with update_memory only when the user confirmed it.

## Presenting choices

- Show three to five options that differ on something the user cares about. For each: name or listing title, neighborhood, entire place or room, beds and baths, rating with review count, the total for the stay with cleaning and service fees included, and the cancellation policy.
- When location matters, show the results or the map with browser_screenshot, show set, when they come from a page in your browser. Name the tradeoff plainly ("$120 more for the whole stay to be walkable to the venue").
- When the user gave exact criteria and one listing clearly wins, you may pick it, but still show the listing, the terms, and the total and get a yes before booking.
- Use clarifying_questions for the pick only when the shortlist is real and short. Otherwise send the summary and let the user reply.

## Paying and confirming

- Before booking, send one clarifying_questions card that restates the listing, the check-in and check-out dates with their weekdays, the guest count, the cancellation terms, and the total from the checkout page. A dismissed card is a no.
- Never book, request to book, or pay without that yes. A request to book commits the user too; the host can accept it and charge the card.
- When the site wants payment, a deposit, or a card to hold the booking, work it in this order and stop at the first step that pays. First, a payment method already saved on the account: select it, and when several are saved, ask which one in the confirmation question. Next, send the Secure Form (request_user_form, the site's domain) for the card inputs the live checkout shows, such as card number, expiry, CVC, name, and billing ZIP; never tell them you can't take their card, and never predict that the form can't reach card inputs embedded from a payment provider. Last, when the form fails or its receipt says a card field failed, or the user would rather type on the page, hand your browser to the user with request_browser_help and one instruction ("Add your card and confirm the payment on `<service>`"); the same handoff covers a CVC re-entry and any 2FA, 3DS, or bank prompt. The user finishes the payment inside that handoff, so when the browser comes back, skip any later confirm or place-order click and read the confirmation page. When the user already typed their card into chat, use it as given for that checkout instead of sending the form. Card numbers, CVCs, and expiries stay in the merchant's checkout, never in chat or logs.
- Then hand the confirm or pay click to the user with request_browser_help and one instruction ("Confirm and pay for your Airbnb stay").
- If the total on the checkout page differs from the total you presented, stop and show both numbers before anything is charged.

## Pitfalls

- The price on a search card is not the checkout total. Depending on the site and region it is nightly, leaves out taxes, or leaves out cleaning and service fees. The checkout page shows the number the card is charged.
- Instant Book confirms at once. Request to Book sends a request the host can decline or leave for a day. Say which one a listing uses, and never call a request a confirmation.
- Strict cancellation windows and non-refundable rates change the decision. Read the policy on the listing page and put the deadline in the question and in the confirmation message.
- Minimum stays and blocked dates make a card look available and the checkout page fail. Read the total for the exact dates before you present it.
- Check-in windows, late-arrival fees, and self check-in codes that arrive on the day of the stay belong in the confirmation message. If the code has not arrived, say when the site says it will.
- A listing's map pin is approximate until the booking is confirmed. Do not promise a block or a street from the pin.
- Never invent availability, a rating, a total, or a confirmation code. If the page did not show it, say so.

## Site guides

Before you open Airbnb or Expedia in your browser, load the `airbnb` or `expedia` skill, whichever names the site you are about to use, and follow the section that matches your step (a read-only lookup, or a booking). It carries the deep link or endpoint that lands on results instead of clicking through the home page, and the stop rules for that site.
