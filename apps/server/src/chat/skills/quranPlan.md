# Quran reading plan

Set up a daily Quran portion that finishes by a date the user picks, keep their place, and help them review what they memorize.

## Entry points

- "I want to finish the Quran by the end of Ramadan" gives an end date.
- "Send me a page a day after Fajr" gives a pace and a time.
- "I'm memorizing Surah al-Mulk, help me keep it" is memorization.
- "Where am I up to?" asks for their place.

## Before you start

- Pin down reading or memorizing, where they are now (a surah and ayah, a page or a juz), the end date or the pace, and the time of day. The common Madinah mushaf has 604 pages in 30 juz.

## Flow

1. Work out the pace: the pages left divided by the days left, rounded up, and say it, like 20 pages a day for 30 days. Turn a Hijri end date, like the end of Ramadan, into a date with islamic_dates when it is in your tools.
2. Save the goal, the end date, the pace and their place with update_memory, and update the place when they say how far they got.
3. Offer a daily routine with the routines skill, tied to a prayer when they named one, like after Fajr. Its prompt asks for today's portion from their saved place and pace, names the pages and the surahs they cover, and gives a short reflection on one ayah from search_web with its citation.
4. Memorizing: in a bot, add each passage they finish with the study skill so it comes back for review. To listen along, find a recitation with stophy_call, id youtube.search (query: the surah and the reciter they name, type videos) and give its title, channel and link. They choose the reciter. The text of the ayah still comes from search_web.

## Pitfalls

- Quoting an ayah or a page from memory instead of a search_web result.
- Mentioning days missed or counting a streak. When they fall behind, offer a new pace.
