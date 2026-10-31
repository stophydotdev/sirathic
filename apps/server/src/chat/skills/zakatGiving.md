# Zakat and giving

Work out the zakat the user owes from their own numbers, then give it, or a sadaqah, to a charity they choose. A gift spends their money, so the one confirmation you owe them is the go/no-go before you pay. Load the calculate skill for the arithmetic when it is in your list.

## Entry points

- "Work out my zakat from these statements" with attached files.
- "I have £12,000 in savings and 40g of gold, how much zakat do I owe?" gives the numbers.
- "Pay my zakat to a charity that builds wells" wants a charity and a payment.
- "Can I give zakat to this charity?" asks about one charity.

## Before you start

- Gather what they own on their zakat date, from attached files or from them: cash and bank balances, gold and silver, shares and funds, money owed to them, business stock, and debts due now. Ask only for what changes the amount.
- The nisab, what counts, and how shares, pensions, jewelry and debts are treated differ between the schools. Search them with search_web and cite them, leading with their madhab from your rules, and say which view each line of the calculation follows.
- The nisab depends on today's gold or silver price. Search it and give the price, its source and its date.

## Flow

1. Calculate with code when you can: each asset, the total, the nisab check and 2.5% of what is due, as a short table. Offer the chart skill when there are many lines.
2. To give it, ask where: a country, a cause or a named charity. Read each candidate's own page with fetch_url: whether it keeps zakat in its own fund for those eligible to receive it, whether it is a registered charity (check the regulator's register for their country), and what it takes from zakat for its costs. Then read what its donors say with stophy_call: trustpilot.search (query: its name) gives the companyDomain, and trustpilot.company.reviews (companyDomain, ratings [1, 2] for the complaints, search for a word like "receipt" or "refund") lists the reviews. Say how many there are and how recent. Reviews show how it treats donors, not where the money goes. Recommend one or two and say why.
3. Confirm the gift with clarifying_questions: the charity, the fund (zakat or sadaqah), the amount and the currency. Give only after they say yes.
4. Give with your browser on the charity's own site. When the site wants payment, work it in this order and stop at the first step that pays. First, a payment method already saved on the account: select it, and when several are saved, ask which one with clarifying_questions. Next, send the Secure Form (request_user_form, the site's domain) for the card inputs the live checkout shows, such as card number, expiry, CVC, name, and billing ZIP; never tell them you can't take their card, and never predict that the form can't reach card inputs embedded from a payment provider. Last, when the form fails or its receipt says a card field failed, or the user would rather type on the page, hand your browser to the user with request_browser_help and one instruction ("Add your card and confirm the payment on `<service>`"); the same handoff covers a CVC re-entry and any 2FA, 3DS, or bank prompt. The user finishes the payment inside that handoff, so when the browser comes back, skip any later confirm or place-order click and read the confirmation page. Card numbers, CVCs, and expiries stay in the merchant's checkout, never in chat.
5. Read the confirmation page and report the reference, the amount, the fund and the charity. Offer to save the calculation as a file for their records when you can make one.

Without a browser in your tools, give the calculation and the links, and say a bot can make the payment.

## Pitfalls

- Giving a nisab or a gold price from memory.
- Adding up their money without saying which view each line follows.
- Paying into a general fund when they asked to give zakat.
