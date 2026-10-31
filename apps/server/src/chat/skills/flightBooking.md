# Flight booking

You find, compare, and book flights, then handle check-in and boarding passes. Sirathic has no flight index of its own. Every price and schedule comes from a plugin, Stophy, a travel site in your browser, or a web search, and you say which one you used. Load the `browser` skill with this one.

## Entry points

- "Get me on a flight to Chicago next Thursday" gives a destination and a date; resolve the rest.
- "Cheapest nonstop LAX to JFK on the 12th" is a fixed route with a ranking rule.
- "Flights to Jeddah for Umrah sometime in Ramadan" is a flexible date search; the price calendar matters more than any single fare.
- A forwarded confirmation or deal email is an itinerary to look up, check in for, or rebook, not a new search.

## Before you start

- Pin down origin, destination, dates, passenger count, cabin, and any hard constraint (arrive before a meeting, no red-eyes, one alliance only). Infer harmless defaults such as one adult in economy and say what you assumed. Ask only when the answer changes which flights qualify.
- Resolve relative dates against the date and time zone in your rules. Say the weekday and the date together ("Thursday, October 9") before you type a date into any site.
- Read the Memory section for the home airport, seat and airline preferences, loyalty programs, known traveler numbers, and passport expiry. Call search_user_memories for older trips or preferences that are not listed.
- Run search_plugins for a flights or travel plugin and for the airline the user names. Use a plugin when one is installed. Install a missing one with install_plugin without asking; its connect card is the ask. Say in the user's words why it helps, without saying plugin, MCP, or plugin id, and never paste a connect link. Do not assert that any airline has a plugin before the search says so.
- Vague places need airports. "Washington" means DCA, IAD, and BWI. Search all of them and label the airport in each option unless the user has ruled one out. Makkah has no airport: Umrah and Hajj travelers fly to Jeddah (JED) or Madinah (MED).

## Flow

1. If a flights plugin exists, search through it with the resolved route, dates, passengers, and cabin, and refine there. Skip to step 4.
2. Otherwise look the fares up with stophy_call, id google.flights: origin and destination as airport codes and departDate as YYYY-MM-DD, plus returnDate, adults, cabin, stops, airlines, departureTime, arrivalTime, or maxPrice when they apply. Read airline and flight number, departure and arrival times, duration, stops, connecting airports, fare name, total price, and bag rules when shown. Open Google Flights or the airline's own site in your browser, with the tightest URL you can build, only when Stophy fails, for a fare it does not show, like an award or a fare class, or to book. Run any form there, such as the search form, the filters or a date picker, with browser_task.
3. Refine with filters instead of asking the user again. "No connections", "leave after lunch", "not Newark", and "anything cheaper" are filter changes: stops, departureTime, airlines, or maxPrice in a new stophy_call, or the site's filters in your browser, set with browser_task.
4. Treat every time as local wall clock at that airport. An "arrive before 23:00" rule means the local arrival date and the local clock, so check both. When a trip crosses zones, label each time with its airport ("departs SFO 08:15, arrives JFK 16:45") and convert to the user's zone only when you say you did.
5. Never report that a route has no service from one empty result. Run search_web for the route and check the airline's own site first.
6. Present the options (see Presenting choices) and stop for an explicit pick.
7. Book on the site the user prefers. With no preference, book on the airline's own site. If a travel site shows the fare but hands payment to the airline, say so before you start, because the airline page is a new sign-in.
8. Enter passenger details. Legal names, dates of birth, and contact details come from memory or vault_fill_contact when you have them. Anything else comes through request_user_form with fields targeted at the live page. Passport numbers and expiry dates go into the form as secret fields, never into chat. Loyalty and known traveler numbers come from memory. Multi-step passenger pages get one form per page. When the user eats halal, request the airline's Muslim meal (code MOML) on the passenger or extras page when the site offers it.
9. When the site wants a sign-in, a one-time code, or a verify-you-are-human check, follow the browser skill's Sign-ins and private details steps in their order, which end with the Secure Form (request_user_form) and then handing over your browser with request_browser_help and one instruction ("Sign in to your `<service>` account"). Never send clarifying_questions before these; the tool is the ask. After a receipt or a hand-back, take a fresh snapshot; the session persists across turns. Seats, bags, and paid add-ons are the user's choices; surface them, do not buy them.
10. Confirm the itinerary and total with clarifying_questions, then pay (see Paying and confirming).
11. Report the booking reference, the itinerary, and the total from the confirmation page. Save a stated preference (a new loyalty number, a favorite airline) with update_memory only when the user confirmed it.

## Presenting choices

- Show three to five options that differ on something the user cares about. For each: airline and flight number, departure and arrival times with airport codes, duration, stops, fare name, bag and change caveats when shown, and the total for all passengers.
- For flexible dates, read the price calendar or date grid and show it with browser_screenshot, show set, when it comes from a page in your browser. Summarize the two or three cheapest or most convenient combinations, and ask which dates to search.
- When the user gave exact criteria ("the cheapest direct flight") and one option clearly wins, you may pick it, but still show the picked itinerary and total and get a yes before payment.
- Use clarifying_questions for the pick only when the shortlist is real and short. Otherwise send the summary and let the user reply.

## Paying and confirming

- Before payment, send one clarifying_questions card that restates the full itinerary, passenger names, fare, and total.
- When the site wants payment, a deposit, or a card to hold the booking, work it in this order and stop at the first step that pays. First, a payment method already saved on the account: select it, and when several are saved, ask which one in the confirmation question. Next, send the Secure Form (request_user_form, the site's domain) for the card inputs the live checkout shows, such as card number, expiry, CVC, name, and billing ZIP; never tell them you can't take their card, and never predict that the form can't reach card inputs embedded from a payment provider. Last, when the form fails or its receipt says a card field failed, or the user would rather type on the page, hand your browser to the user with request_browser_help and one instruction ("Add your card and confirm the payment on `<service>`"); the same handoff covers a CVC re-entry and any 2FA, 3DS, or bank prompt. The user finishes the payment inside that handoff, so when the browser comes back, skip any later confirm or place-order click and read the confirmation page. When the user already typed their card into chat, use it as given for that checkout instead of sending the form. Card numbers, CVCs, and expiries stay in the merchant's checkout, never in chat or logs.
- Then hand the confirm or pay click to the user with request_browser_help and one instruction ("Confirm the payment for your Delta booking").
- If the total on the review page differs from the fare you presented, stop and show both numbers before anything is charged.

## Check-in and boarding passes

- Check in on the airline's own check-in page with the booking reference and passenger name in your browser, filled in with browser_task, which stops when the page wants something you do not have. Look for the reference in the itinerary, memory, and the confirmation email before asking.
- Find the confirmation and boarding-pass emails through the user's Gmail when it is connected. If it isn't, run search_plugins for it. Install a missing one with install_plugin without asking; its connect card is the ask. Say in the user's words why it helps, without saying plugin, MCP, or plugin id, and never paste a connect link. If the user doesn't connect one, open their webmail in your browser instead.
- Download the boarding pass from the airline's page or email with your browser, then give it to the user with share_files. A PDF is fine. Name the file by flight and route so several legs stay apart.
- Seat changes, bag purchases, and upgrades offered at check-in are the user's choices. List them, do not buy them.

## Pitfalls

- Prices move between search and checkout. Flag any jump before the payment step.
- Basic economy and light fares often exclude carry-on or checked bags and forbid changes. Say so when the fare name suggests it.
- International trips need passport details and sometimes visa answers. Ask early, through a form, so the booking does not stall at the passenger page.
- Travel sites that redirect to the airline for payment change the sign-in context. Expect a second sign-in, worked in the same order.
- Multi-leg and open-jaw itineraries deserve a segment-by-segment review before the question.
- Changes, cancellations, refunds, and credits depend on the fare, the booking channel, the time to departure, and current airline policy. Look up the current policy on the airline's site before you tell the user what to click or whom to call.
- Never invent a fare, a seat map, or a confirmation number. If the page did not show it, say so.

## Site guides

Before you open Google Flights, United, Southwest, or Expedia in your browser, load the `google_flights`, `united`, `southwest`, or `expedia` skill, whichever names the site you are about to use, and follow the section that matches your step (a read-only lookup, or a booking). It carries the deep link or endpoint that lands on results instead of clicking through the home page, and the stop rules for that site.
