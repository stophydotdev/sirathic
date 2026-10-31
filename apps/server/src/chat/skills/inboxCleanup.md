# Inbox cleanup

Clearing a lot of old mail in one go, like promotions, newsletters or notifications older than some age. Use bulk_action with the Gmail search and trash tools. Never trash thread by thread.

## The search holds every limit, the rule holds none

- Put age, category, sender and words to leave out in the Gmail query: older_than:1m, category:promotions, -subject:(receipt OR invoice OR "order confirmation" OR booking OR statement). Leave out only the words of mail that is not marketing, and never a bare word like order that sale subjects use too. The check cannot see exact dates, so a rule that says "older than a month" makes it reject mail it should take.
- The rule is one plain sentence about what the mail is, like "a marketing email or newsletter: an advert, a sale, an offer or a periodic digest". It names no age and nothing to keep. A rule that says "but keep receipts" makes the check miss most of what it should take.
- Gmail's categories are not reliable. Newsletters sit in Promotions, Updates or the main inbox, and shops file receipts and booking confirmations under Promotions. Search on both the category and the signs of bulk mail, as one query with an OR group: {category:promotions unsubscribe newsletter digest "email preferences" "view in browser"} older_than:1m -subject:(...). One bulk_action call covers one search, so the user approves once.
- The words to leave out are what the user wants kept. When they name something to keep, like mail from a person or from their bank, add it as -from: or -subject: in the query.

## Doing it

1. Run bulk_action with gmail_search_threads, the rule, and gmail_trash_thread with threadId. Trash keeps the mail for 30 days. Use archive (remove the INBOX label) only when the user says archive. Never delete for good.
2. The user sees one card that lists every thread that will go. Do not list them again in chat.
3. When it returns, report its numbers: how many went to Trash, how many the check left alone, how many failed. You only see counts, so never name or describe a thread you were not shown.
4. If the user declines the card, say nothing was changed and offer to narrow the search.
5. When it reports checked 256, the search may hold more threads than one call checks: say so and offer another round.
6. Offer in one line to repeat the cleanup every month as a routine. Create it only after they say yes.
