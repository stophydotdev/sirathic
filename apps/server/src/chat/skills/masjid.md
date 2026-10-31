# Masjid and Jumu'ah

Find masjids near the user and read their prayer and Jumu'ah times from the masjid itself.

## Entry points

- "Where can I pray Jumu'ah near King's Cross?" wants a masjid and its khutbah times on Friday.
- "A masjid near me with a women's area" has a hard constraint.
- "What time is Isha jama'ah at East London Mosque?" names a masjid.
- "Add Jumu'ah to my calendar every Friday" wants a calendar event.
- "Keep my masjid's times in my calendar" wants Jumu'ah and the month's jama'ah times as events, kept up to date each month.

## Before you start

- Pin down where: a neighborhood, an address, or "near me" with a location from the conversation or memory. When you have none, ask with clarifying_questions, or in one short line of text where that tool is not available.
- Note the hard constraints: a women's area, wheelchair access, parking, wudu facilities, the language of the khutbah.

## Flow

1. Find candidates with stophy_call, id google.maps.search, with query "mosque" and then "masjid" and the place as location. Keep the name, the address, the distance and the website.
2. For each finalist, find its timetable page with stophy_call, id web.map, url the masjid's site and search "prayer timetable", which lists the matching pages best first. Read that page with fetch_url, which also reads a timetable PDF from its address. Use your browser only when the timetable is an image or a widget. A masjid timetable gives two times for each prayer: the start time and the jama'ah (iqamah) time. Report the jama'ah time for praying with the congregation. Jumu'ah often has more than one khutbah; list each one. A page that shows a timetable's headings but no times fills them in with a script: open the timetable PDF or calendar it links to instead.
3. When you cannot read the masjid's own time, say so, give the start times from prayer_times, and suggest calling them. Never invent a jama'ah time.
4. Present each masjid with its distance, the times the user asked for and the dates they apply to, each constraint as met or unknown, and the link to the timetable.
5. Offer once to add Jumu'ah to their calendar as a weekly event at the time you read; load the scheduling skill for it. Say that the masjid can change the time, often when the clocks change.

## Keep a masjid's times in their calendar

Do these in one pass and report once at the end. Load scheduling and routines with this skill.

1. Masjid. Use the one they name, or the one they pick from the Flow above; ask only when two fit. Read this month's timetable and check its dates. When you cannot read its jama'ah times, say so and stop: never put calculated times in their calendar as a masjid's.
2. Events. With the connector's create_event, make an event for the jama'ah time of each prayer they name, or all five when they name none, on each day left in the month, titled "Fajr jama'ah" and so on, and one for each Jumu'ah khutbah on each Friday, titled "Jumu'ah". Use the masjid's time zone, 30 minutes each, the masjid as the location. Put "Masjid times by Sirathic" and the timetable link on the first line of the description. Copy each time exactly as the timetable gives it, and create the events in parallel, as many calls in one step as you can.
3. Run again. Before you create anything, list_events over the month with the full text "Masjid times by Sirathic". Update_event a time that changed, create only what is missing, and never delete or duplicate. After the writes, list_events again and fix any time that differs from the timetable.
4. Each month. Set a monthly routine for the first of the month, in the morning, that reads the masjid's timetable again and runs step 3 for the new month. Write its prompt as the goal, with the masjid's name, its timetable link and the first line above. It posts one line only when a time changed or the timetable could not be read, and replies SKIP otherwise. Read list_routines first and edit the routine when one exists.
5. Report in a few lines: the masjid, its Jumu'ah time or times, how many events you added or changed, the routine, and that the masjid can change its times, often when the clocks change, so the next monthly read picks it up.

## Pitfalls

- Giving a calculated prayer time as a masjid's jama'ah time.
- Reading a timetable for the wrong month; check the dates on it.
- Taking a masjid's Google Maps opening hours as its prayer times.
- Trusting a prayer-times listing or screen app whose Jumu'ah time equals its Dhuhr jama'ah on other days. Many show the Dhuhr time as Jumu'ah when the masjid never set one, so use it only when Friday differs.
