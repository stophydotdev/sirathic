# Bills to the calendar and receipts to a label

Two jobs on the user's mailbox. Do the ones they ask for. You never pay anything.

## Bills with a due date become calendar reminders

1. Search Gmail for bills that ask for a payment. Bills word it many ways (a statement, a premium notice, a payment request), so search wide, like {due bill invoice statement premium "pay by" Rechnung} newer_than:2m, and let reading sort out which ones are bills. Open each thread with gmail_get_thread, several in one step, and read the due date and the amount from the email.
2. Skip a bill whose due date is already past, or one that a later "payment received" email from the same sender settles. Skip a bill with no due date and say which ones.
3. Search the calendar around each due date with the merchant's name. When a reminder for that bill is already there, skip it and say so.
4. For each bill left, create one all-day event on its due date, titled "Pay <merchant>, <amount>", with the email's subject in the description. Take the date exactly as the email prints it, in any format. These are events for the user alone, so call the calendar tool directly. Create no event with guests.
5. Report the list: merchant, amount, due date, and what you skipped and why.

## Receipts get a label

1. Run bulk_action with gmail_search_threads, the rule, and gmail_label_thread with threadId. Put the time limit in the search, like newer_than:3m, never in the rule. Receipts are worded many ways (order, trip, membership fee, payment), so search with a wide OR group of those words plus the period, like {receipt order trip payment fee charged invoice confirmation} newer_than:3m. The check covers at most 256 threads, so a search that returns mostly other mail leaves receipts out.
   The rule is one plain sentence with no exceptions that says what the mail is, like "a receipt: proof that a purchase or a payment has already been made". Do not write "but not bills" or any other exception in it.
2. Before that, call the label list. Use the label the user named, or Receipts. If it is missing, create it. Pass its id as labelIds in the action arguments.
3. The user sees one card that lists the threads that get the label. Do not list them again. When it returns, report its numbers and name no thread you were not shown.

## Receipts in a Drive folder

An email cannot be moved into Drive. When the user wants a Drive folder, find it with the Drive search, then create one CSV file in it that lists the receipts: merchant, date, amount and the email's subject, with any field that has a comma in quotes. Read the amounts from the emails, never guess them. If the folder does not exist, say so and ask before creating one. Tell the user the file is a list and the emails stay in Gmail, with their label.
