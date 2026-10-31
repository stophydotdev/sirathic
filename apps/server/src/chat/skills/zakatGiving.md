# Zakat and giving

Work out the zakat the user owes from their own numbers, then give it, or a sadaqah, to a charity they choose. A gift spends their money, so the one confirmation you owe them is the go/no-go before you pay. Load the calculate skill for the arithmetic and the routines skill for the reminder in the same call as this one, and plugins when their statements are in email or Drive.

## Entry points

- "Work out my zakat from these statements" with attached files.
- "I have £12,000 in savings and 40g of gold, how much zakat do I owe?" gives the numbers.
- "Pay my zakat to a charity that builds wells" wants a charity and a payment.
- "Can I give zakat to this charity?" asks about one charity.
- "Use the statements in my email" or "in my Drive" wants the connectors.

## Before you start

- Gather what they own on their zakat date, from attached files or from them: cash and bank balances, gold and silver, shares and funds, money owed to them, business stock, and debts due now. Ask only for what changes the amount.
- The nisab, what counts, and how shares, pensions, jewelry and debts are treated differ between the schools. Search them with search_web and cite them, leading with their madhab from your rules, and say which view each line of the calculation follows.
- The nisab depends on today's gold or silver price. Search it and give the price, its source and its date.

## From their statements

- Find the statements. A PDF attached to the chat arrives as text and a CSV arrives as text in the message. For their email or Drive, load the plugins skill, search for their bank's statements, open each attachment with the connector's tools and say which files you used. When a connector cannot open an attachment, or a PDF has no text layer, say so and ask for an upload. Open nothing in their mail or Drive except statements.
- Fix one zakat date first, from them or from memory, and take every account's balance on that date. Without a date, ask your questions before you search or calculate anything. When a statement does not cover the date, ask for the one that does. Never carry a balance from another date.
- Read the numbers in code, not by eye. Put each account's name, currency and every line (date, amount, and the balance the statement prints) into one code_execution script. It prints the balance on the zakat date, which is the printed balance of the last line on or before that date, and checks that the opening balance plus the lines equals the printed closing balance. Statements list lines newest first or oldest first, and PDF text can lose which column a figure came from, so read a line's direction from how the running balance moves. A transfer between their own accounts shows on both statements and needs no adjustment, because you add balances, not transactions. When a check fails, find the line you misread before going on. The totals per currency come from the script too.
- A balance in another currency is converted at a rate you searched. Give the rate, its source and its date.
- Keep statement contents out of memory and out of a routine prompt: no account holder's name, account numbers, transactions, balances or amounts, and call the user "the user" in the prompt, never by a name from a statement. Save nothing, not even their zakat date or madhab, until they say yes to it, and then save only those two.
- Ask only what the statements cannot say, in one short list in one message: gold and silver they hold, money owed to them that they expect back, business stock, debts due now that the statements do not show, other accounts, their zakat date and their madhab. Skip what they already said or memory holds.
- Some things the statements show are treated differently by the schools: interest credited to a savings account, a credit card balance, a loan or an instalment, and money that arrived part-way through the year. Search each with search_web, cite it, and say which view the line follows. Do not decide one yourself.
- The table has one row per line: the account or asset, its amount, and the cited view it follows, including the nisab you used and the rate. Every sentence that states a ruling, a nisab, a price or a school's view carries its source. A ruling you cannot cite stays out of the answer. State one amount, the one that follows the cited views for their madhab, and give another view's amount only as a labelled second line.

## Flow

1. Calculate with code when you can: each asset, the total, the nisab check and 2.5% of what is due, as a short table. Offer the chart skill when there are many lines.
2. To give it, ask where: a country, a cause or a named charity. Read each candidate's own page with fetch_url: whether it keeps zakat in its own fund for those eligible to receive it, whether it is a registered charity (check the regulator's register for their country), and what it takes from zakat for its costs. Then read what its donors say with stophy_call: trustpilot.search (query: its name) gives the companyDomain, and trustpilot.company.reviews (companyDomain, ratings [1, 2] for the complaints, search for a word like "receipt" or "refund") lists the reviews. Say how many there are and how recent. Reviews show how it treats donors, not where the money goes. Recommend one or two and say why.
3. Confirm the gift with clarifying_questions: the charity, the fund (zakat or sadaqah), the amount and the currency. Give only after they say yes.
4. Give with your browser on the charity's own site. When the site wants payment, work it in this order and stop at the first step that pays. First, a payment method already saved on the account: select it, and when several are saved, ask which one with clarifying_questions. Next, send the Secure Form (request_user_form, the site's domain) for the card inputs the live checkout shows, such as card number, expiry, CVC, name, and billing ZIP; never tell them you can't take their card, and never predict that the form can't reach card inputs embedded from a payment provider. Last, when the form fails or its receipt says a card field failed, or the user would rather type on the page, hand your browser to the user with request_browser_help and one instruction ("Add your card and confirm the payment on `<service>`"); the same handoff covers a CVC re-entry and any 2FA, 3DS, or bank prompt. The user finishes the payment inside that handoff, so when the browser comes back, skip any later confirm or place-order click and read the confirmation page. Card numbers, CVCs, and expiries stay in the merchant's checkout, never in chat.
5. Read the confirmation page and report the reference, the amount, the fund and the charity. Offer to save the calculation as a file for their records when you can make one.
6. Whether or not they give now, offer a reminder for next year's zakat date, and set it with the routines skill when they say yes. Ask whether their date is Hijri or Gregorian. A Gregorian date is a yearly routine. A Hijri date moves against the Gregorian calendar each year, so set a once routine on next year's expected date (islamic_dates when it is in your tools, otherwise search it), say the date is expected, and say you will set the next one then. The prompt reminds them and offers to work out their zakat again from fresh statements. It holds the zakat date at most, and no names, amounts, account details or other facts from their statements.

Without a browser in your tools, give the calculation and the links, and say a bot can make the payment.

## Pitfalls

- Giving a nisab or a gold price from memory.
- Adding up their money without saying which view each line follows.
- A ruling, a hadith or a school's view with no source next to it.
- Working out an amount before you have their zakat date.
- Adding balances by eye, or taking a balance from a different date than their zakat date.
- Saving a name, account numbers, transactions or balances from a statement to memory or into a routine prompt.
- Paying into a general fund when they asked to give zakat.
