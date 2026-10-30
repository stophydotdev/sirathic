# Qurbani and aqiqah

Compare providers and order a qurbani (udhiyah) or an aqiqah for the user, then report what was ordered. An order spends their money, so the one confirmation you owe them is the go/no-go before you pay.

## Entry points

- "Book my qurbani this year, one share in Somalia" gives a share and a country.
- "Where is the cheapest qurbani in the UK?" wants a comparison.
- "Order an aqiqah for my newborn son" wants an aqiqah; how many animals depends on the child, so search and cite it.
- "Can I do a qurbani for my late father?" is a fiqh question first: search and cite it.

## Before you start

- Pin down qurbani or aqiqah, how many animals or shares and for whom (the names, when the provider asks for them), where it is done (a local farm or a country abroad), the budget, and whether the meat is delivered or given away.
- A qurbani is done in the days of Eid al-Adha. Get the dates with islamic_dates when it is in your tools, say they are expected, and order before the provider's deadline. Rulings on who must give it, sharing an animal, and the age and condition of the animal come from search_web with citations, giving the views.

## Flow

1. Find providers with search_web: charities and farms that offer it in that country. Read each one's own page with fetch_url: the price per share or animal, the country, the animal, when it is slaughtered, whether you get a confirmation or a photo, and whether it is a registered charity (check the charity regulator's register for their country).
2. Compare them in a short table: provider, country, animal, price, deadline, proof and registered. Recommend one and say why.
3. Confirm the order with clarifying_questions: the provider, the animal or share, the country, the names and the total. Order only after they say yes.
4. Order with your browser on the provider's own site. When the site wants payment, work it in this order and stop at the first step that pays. First, a payment method already saved on the account: select it, and when several are saved, ask which one with clarifying_questions. Next, send the Secure Form (request_user_form, the site's domain) for the card inputs the live checkout shows, such as card number, expiry, CVC, name, and billing ZIP; never tell them you can't take their card, and never predict that the form can't reach card inputs embedded from a payment provider. Last, when the form fails or its receipt says a card field failed, or the user would rather type on the page, hand your browser to the user with request_browser_help and one instruction ("Add your card and confirm the payment on `<service>`"); the same handoff covers a CVC re-entry and any 2FA, 3DS, or bank prompt. The user finishes the payment inside that handoff, so when the browser comes back, skip any later confirm or place-order click and read the confirmation page. Card numbers, CVCs, and expiries stay in the merchant's checkout, never in chat.
5. Read the confirmation page and report the reference, what was ordered, for whom, the total and when it will be done. If the page shows no reference, say so instead of inventing one.

Without a browser in your tools, give the comparison and the links, and say a bot can place the order.

## Pitfalls

- Paying a provider you could not check.
- Ordering after the provider's deadline.
- Ruling yourself on whether the user must give a qurbani.
