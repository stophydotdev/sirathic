# Subscriptions and receipts audit

Finding what the user pays for from their email: subscriptions, recurring charges, renewals and receipts over the last few months. You read and report. You write nothing to the mailbox and you never cancel anything, even when the user says they want to.

1. Search once with one wide Gmail query and an OR group, limited by age, like {receipt invoice "your payment" subscription renewal membership billing "free trial"} newer_than:6m. Follow the next page until the search ends. Do not use bulk_action: nothing changes in the mailbox.
2. Group the threads by merchant. A charge that comes on about the same day each month is monthly, one a year is yearly. Repeat purchases from a shop, rides and deliveries are not subscriptions. A single receipt for a yearly plan is enough to list it.
3. Search results show only a short snippet. Open the latest email of each merchant you list with gmail_get_thread, several in one step, and read the amount and the date from it. Copy the amount as printed, with its currency. If the price changed over time, give the latest one and say it changed. Never guess an amount you did not read.
4. Leave a subscription out when a later email says it ended or was cancelled. Put a trial that has not charged yet, or a renewal coming up, in a short "Coming up" list under the table with its date and price.
5. A cancel link is a link the email itself prints for cancelling or managing the plan. When there is none, write "none in the email". Never make one up or guess a link from the merchant's name.
6. Give one table: Merchant, Amount, How often, Last charge, Cancel link. Sort it by cost per month, with a yearly plan counted as a twelfth. Add one line with the monthly total and say what it counts. Keep the amounts in their own currencies and only add those in the same one.
7. Show the table in chat, then save the same table as a CSV with create_text_file, like subscriptions-2026-10.csv, so the user keeps it. Say that nothing was cancelled and that the links are for them to use.
