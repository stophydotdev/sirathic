# People Search

Find people by name, role, company, education, skill, or location.

## Tool Selection

Sirathic has no people index. Find people with search_web, and read a LinkedIn profile, a person's LinkedIn posts or a LinkedIn company page with stophy_search_endpoints, then stophy_call. These read by URL or id; none of them searches. Search the web when:

- The query targets a specific organization's team/about page (VC partner lists, lab group pages, C-suite rosters)
- Criteria need temporal awareness ("currently at X", "left Y in 2024")
- The domain is niche academic (specific lab, conference community, thesis topic)
- Results are many but few are true matches after filtering

## Searching

Keep queries to about 5 to 7 meaningful tokens. Past 8 tokens a search can't match all terms - split criteria across multiple shorter queries.

**Vary queries.** A single query misses about 20% of relevant people. Run 3+ queries varying:

- Role titles + acronyms ("PM" / "product manager" / "product lead")
- Company name forms ("a16z" / "Andreessen Horowitz", "HPE" / "Hewlett Packard Enterprise")
- Industry terms ("ISV" / "independent software vendor")
- Scope slicing (team, geography, seniority)

Skip the acronym/expansion pairing only when the acronym is the dominant brand (IBM, SAP).

One search_web call takes up to three queries, so one call covers one round of variants. Scale the rounds to breadth: one or two for moderate searches, more for broad sweeps.

### Deduplication

Merge the hits by URL, keeping the one with the longest summary.

### Filtering

Read each candidate against the criteria. Phrase the criteria as exclusions: "Drop if NOT a senior PM, NOT at a fintech, or NOT London-based" produces fewer false positives than "Include only X". Anchor on the candidate's summary.

- No keyword pre- or post-filtering. Pre-filtering silently drops fuzzy matches (translated company names, location synonyms, truncated snippets).
- The filter step is not optional - web results return many loosely-matching profiles. Without filtering, expect significant noise.
- Do not ask the filter for fields the summary doesn't contain and you haven't enriched - you will end up writing "unknown" and it will ship.

### When summaries are incomplete

Summaries reliably contain name, title, company, location, and the top 1 or 2 Experience entries. They often omit older jobs, education, publications, and bio.

- **Older jobs or education** - read the candidate's LinkedIn profile with stophy_call. It returns headline, location, about, every role (title, company, dates, whether current) and education (school, degree, dates). One profile per call, so enrich only the candidates that matter.
- **Publications, bio, or anything outside that** - fetch_url the pages, and read what they say. If a page is a login wall or empty, fall back to search_web with "<name> <company> <field>".
- **A person's recent writing** - their LinkedIn posts have their own endpoint. Company pages are read with the LinkedIn company endpoint.

## Recipes

**Named person lookup** - a single query, no pipeline: search_web "Jane Doe Acme Corp".

**Broad search** - search → dedup → enrich → filter, with a dossier step when the deliverable needs it.

1. **Search + dedup** - 3+ query variants (role/acronym, company/expansion, industry, scope), merged by URL, keeping the longest summary.
2. **Enrich** - read the candidate LinkedIn profiles whose company history or education the filter needs.
3. **Filter** - read each candidate against the criteria, phrased as exclusions, anchored on the summary **and** the enrichment fields where they sharpen the call.
4. **Dossier (conditional)** - required when the deliverable needs publications, bio, exact tenure dates, or any field outside the profile. Read the pages with fetch_url. Do not fill dossier fields from the search summary - you will end up writing "unknown" and it will ship.

Build the final deliverable from the dossiers when step 4 ran, otherwise from the filtered matches.

**Combined search** - find team pages first, then people:

1. search_web "{company} {role} team", naming the company's site - find team pages, directories, press releases.
2. fetch_url the pages and take names from them.
3. search_web "{name} {company}" - enrich named candidates.

## Gotchas

- **Always hyperlink the profile URL on the person's name in the final answer** - never deliver names as bare text, in a separate "LinkedIn" column, or as a trailing URL. The name _is_ the link: `- [Jane Doe](https://www.linkedin.com/in/janedoe) - Senior PM, Acme (London)`. Applies to prose and tables (link the name cell, drop any standalone URL column).
- **Never fabricate email addresses from patterns** - `firstname.lastname@company.com` guesses are unverified and have reached deliverables. Deliver the LinkedIn URL only, or an address a page actually shows.
- **Coverage gaps** - very senior executives, public figures, people without LinkedIn profiles, and recent job changes may be absent. Fall back to the wider web.
- **Names often truncated** - results frequently show "First L" instead of full names. Read the profile URL to resolve.
