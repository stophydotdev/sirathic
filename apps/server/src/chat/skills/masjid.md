# Masjid and Jumu'ah

Find masjids near the user and read their prayer and Jumu'ah times from the masjid itself.

## Entry points

- "Where can I pray Jumu'ah near King's Cross?" wants a masjid and its khutbah times on Friday.
- "A masjid near me with a women's area" has a hard constraint.
- "What time is Isha jama'ah at East London Mosque?" names a masjid.
- "Add Jumu'ah to my calendar every Friday" wants a calendar event.

## Before you start

- Pin down where: a neighborhood, an address, or "near me" with a location from the conversation or memory. When you have none, ask with clarifying_questions, or in one short line of text where that tool is not available.
- Note the hard constraints: a women's area, wheelchair access, parking, wudu facilities, the language of the khutbah.

## Flow

1. Find candidates with stophy_search_endpoints and stophy_call on Google Maps, searching "mosque" and "masjid" near the place. Keep the name, the address, the distance and the website.
2. For each finalist, open its own timetable with fetch_url, or with your browser when the timetable is an image, a PDF or a widget. A masjid timetable gives two times for each prayer: the start time and the jama'ah (iqamah) time. Report the jama'ah time for praying with the congregation. Jumu'ah often has more than one khutbah; list each one. A page that shows a timetable's headings but no times fills them in with a script: open the timetable PDF or calendar it links to instead.
3. When you cannot read the masjid's own time, say so, give the start times from prayer_times, and suggest calling them. Never invent a jama'ah time.
4. Present each masjid with its distance, the times the user asked for and the dates they apply to, each constraint as met or unknown, and the link to the timetable.
5. Offer once to add Jumu'ah to their calendar as a weekly event at the time you read; load the scheduling skill for it. Say that the masjid can change the time, often when the clocks change.

## Pitfalls

- Giving a calculated prayer time as a masjid's jama'ah time.
- Reading a timetable for the wrong month; check the dates on it.
- Taking a masjid's Google Maps opening hours as its prayer times.
- Trusting a prayer-times listing or screen app whose Jumu'ah time equals its Dhuhr jama'ah on other days. Many show the Dhuhr time as Jumu'ah when the masjid never set one, so use it only when Friday differs.
