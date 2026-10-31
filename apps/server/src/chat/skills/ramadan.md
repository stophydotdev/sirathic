# Ramadan

Help the user through Ramadan: suhoor and iftar times, timetables, reminders, the fasts they still owe, the last ten nights, and zakat al-fitr. Every ruling comes from search_web with citations; this skill gives the steps.

## Entry points

- "When is iftar today in Birmingham?" wants one time.
- "Make me a Ramadan timetable for Toronto" wants the month.
- "Remind me 20 minutes before Maghrib every day in Ramadan" wants a routine.
- "I missed 6 fasts last year" wants a plan to make them up.
- "How much is zakat al-fitr this year?" wants an amount for their country.
- "Set up Ramadan for me in Leeds" wants the whole month set up: their calendar, a Quran routine, the last ten nights and iftar invites.

## Before you start

- Find their city in the conversation or memory, and ask for it when you have none. Use their madhab from your rules for Asr and to lead the rulings when known.
- Ramadan's start and Eid are expected dates until their country or masjid announces them. Say so, and never state the start as fixed.

## Flow

- Times: suhoor ends at Fajr and iftar is at Maghrib. Get them from prayer_times with the method of their country, and say which method. When the user names their masjid, read its Ramadan timetable with fetch_url and prefer it; many add an earlier imsak, a precaution before Fajr, and when you explain it, cite a source. Say that calculated times can differ from a masjid's by a few minutes.
- A timetable is prayer_times for the days of Ramadan in one call, shown as a table of the date, the day of Ramadan, the end of suhoor and iftar. Offer it as a file when you can make one.
- Reminders are routines, so load the routines skill. A daily reminder before Maghrib or Fajr sets schedule.prayer so it moves with the prayer, and its prompt keeps it to Ramadan as that skill says for Hijri dates.
- Missed fasts: whether they owe qada, fidya or kaffarah depends on why they missed them. Search it, cite it, and ask the reason only when the answer depends on it. Keep the count with update_memory only when they ask you to track it.
- Zakat al-fitr is one sa' of staple food per person, or half a sa' of wheat in the Hanafi school. Local bodies, like a national zakat body, a council of scholars or their masjid, publish its cash value each year. Search this year's value for their country and cite who set it and when. Views differ on paying it in money or in food; give them, leading with their madhab. It is due before the Eid prayer.
- The last ten nights: give the odd nights as expected dates, and remind with routines the same way.

## Set up Ramadan

Do these in one pass and report once at the end. Load scheduling, routines and quran_plan with this skill.

1. Place and dates. Take the city from the conversation or memory, and ask only when you have none. Search the start and the end of Ramadan for their place and cite them: their masjid's announcement or their national body's, else the expected dates. Say they depend on the moon. When a source gives only Eid, the last fast is the day before.
2. Times. Call prayer_times once from the first fast for every day of the month, with the method of their country. Suhoor ends at Fajr and iftar is at Maghrib, so add no imsak, unless their masjid's timetable has one: read it, and cite a source when you explain it.
3. Calendar. Make two events a day in their calendar with the connector's create_event: "Suhoor ends (Fajr)" at the Fajr time for 10 minutes and "Iftar (Maghrib)" at the Maghrib time for 30 minutes, with the place's time zone. Put "Ramadan setup by Sirathic" and the method on the first line of each description. Copy each time exactly as prayer_times gives it, and create the events in parallel, as many calls in one step as you can.
4. Check and run again. Before you create anything, list_events over the whole month with the full text "Ramadan setup by Sirathic". For a day that already has the event, leave it when its time is right and update_event when it is not. Create only what is missing and never delete. After the writes, list_events again, compare every time with prayer_times and fix any that differ with update_event. The same goes for their routines: read list_routines and edit one that exists.
5. Quran. With the quran_plan skill, set a daily routine that finishes the Quran by the end of Ramadan, after Fajr, and say the pace. Its prompt says to reply SKIP until the first fast.
6. Last ten nights. Search which nights they are and which are odd, cite it, and call the dates expected. Set one daily routine after Isha that replies SKIP outside them.
7. Iftar invites. Offer once to draft an invitation for a night they pick. Ask who and where, take each address from them, and leave a Gmail draft with gmail_create_draft for them to send, never gmail_send_email. Send nothing and put no guest on a calendar event.
8. Report in a few lines: the dates and that the moon decides them, the method, how many events you added or changed, the routines, and that their masjid's times can differ by a few minutes.

## Pitfalls

- Giving an iftar or suhoor time from memory, or for the wrong city.
- Treating calculated Ramadan dates as announced ones.
- Counting missed fasts in a routine, or reporting what they missed.
- Writing the month's events one step at a time, or twice on a second run.
