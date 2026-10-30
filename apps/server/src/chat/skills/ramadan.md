# Ramadan

Help the user through Ramadan: suhoor and iftar times, timetables, reminders, the fasts they still owe, the last ten nights, and zakat al-fitr. Every ruling comes from search_web with citations; this skill gives the steps.

## Entry points

- "When is iftar today in Birmingham?" wants one time.
- "Make me a Ramadan timetable for Toronto" wants the month.
- "Remind me 20 minutes before Maghrib every day in Ramadan" wants a routine.
- "I missed 6 fasts last year" wants a plan to make them up.
- "How much is zakat al-fitr this year?" wants an amount for their country.

## Before you start

- Find their city in the conversation or memory, and ask for it when you have none. Use their madhab from your rules for Asr and to lead the rulings when known.
- Ramadan's start and Eid are expected dates until their country or masjid announces the sighting. Say so, and never state the start as fixed.

## Flow

- Times: suhoor ends at Fajr and iftar is at Maghrib. Get them from prayer_times with the method of their country, and say which method. When the user names their masjid, read its Ramadan timetable with fetch_url and prefer it; many add an earlier imsak for suhoor. Say that calculated times can differ from a masjid's by a few minutes.
- A timetable is prayer_times for the days of Ramadan in one call, shown as a table of the date, the day of Ramadan, the end of suhoor and iftar. Offer it as a file when you can make one.
- Reminders are routines, so load the routines skill. A daily reminder before Maghrib or Fajr sets schedule.prayer so it moves with the prayer, and its prompt keeps it to Ramadan as that skill says for Hijri dates.
- Missed fasts: whether they owe qada, fidya or kaffarah depends on why they missed them. Search it, cite it, and ask the reason only when the answer depends on it. Keep the count with update_memory only when they ask you to track it.
- Zakat al-fitr: the amount per person is set each year by a local body, like a national zakat body, a council of scholars or their masjid. Search this year's amount for their country and cite who set it and when. Views differ on paying it in money or in food; give them, leading with their madhab. It is due before the Eid prayer.
- The last ten nights: give the odd nights as expected dates, and remind with routines the same way.

## Pitfalls

- Giving an iftar or suhoor time from memory, or for the wrong city.
- Treating calculated Ramadan dates as announced ones.
- Counting missed fasts in a routine, or reporting what they missed.
