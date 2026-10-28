# Document Review

Review documents to identify errors, inconsistencies, and factual inaccuracies.

## Ground Rules

- **Never fabricate sources.** Cite only what your tools returned, with the source numbers they gave. An empty source list is preferable to a made-up one.

## Definitions

### Sections

A "section" is a logical grouping of related content that spans one or more consecutive pages (or one or more sheets for XLSX). Sections divide the document into reviewable chunks. Each section must:

- Cover a specific page range (e.g., "Pages 3-7: Methodology"). For XLSX, each section corresponds to one or more worksheets.
- Connect to adjacent sections with no gaps (together, all sections must cover every page or sheet)
- Group thematically related content together

A section has a unique name that also describes what it is about (e.g., "Introduction", "Financial Performance", "Methodology") and a page range.

### Claims

A "claim" is a factual statement in the document that requires external verification or calculation to confirm. For each one, note the exact verbatim text, the section it is in, and where it is: the page or slide number, or the sheet name for XLSX, plus a precise position such as "paragraph 5", "Table 2, row 3" or the cell "B14".

### Claim Types

- `verify_public_data`: Facts that need external sources to verify. Requires a search to fact-check.
  - Statistics ("U.S. population is 340 million")
  - Historical facts ("The Paris Agreement was signed in 2016")
  - Published data ("The study had 10,000 participants")
  - Attributed claims ("According to WHO, global life expectancy is 73 years")
  - A verse of the Quran or a hadith quoted in the document, with its reference ("Surah Al-Baqarah 2:286", "narrated by al-Bukhari")
  - A ruling the document states ("scholars agree that...")

- `numerical_consistency`: Calculations using numbers from within the document. Requires a calculation to verify.
  - Addition/subtraction ("Region A: 500 + Region B: 300 = 800 total")
  - Percentages ("40% of 1,000 respondents = 400")
  - Ratios ("$2.4M budget / 12 months = $200K per month")
  - Growth calculations ("from 100 to 125 = 25% growth")

### Claim Statuses

- `unverified`: Initial status: the claim has not been fact-checked yet.
- `verified`: Fact-checked and determined to be correct. For a quoted verse or hadith: the wording is exact, the reference is right, and the saying is kept with the person it belongs to.
- `refuted`: Fact-checked and determined to be false. Refuted claims become issues. For a quoted verse or hadith: the wording or the reference is wrong, or the saying is given to the wrong person.
- `inconclusive`: Fact-checked, but no conclusion can be made. Inconclusive claims become issues. A hadith your sources do not have is inconclusive, never refuted: a search that finds nothing is not a verdict.

### Issues

An "issue" is a specific problem found in the document. Issues are the primary output of the review.

An issue has:

- `issue_type`: One of the five types defined below (`spelling_grammar`, `narrative_logic`, `non_public_info`, `verify_public_data`, `numerical_consistency`)
- `severity`: `high`, `medium`, or `low` (see Severity Levels below)
- The exact verbatim text from the document that contains the issue. This is the text you would highlight to show a reader where the problem is.
- A description of why that text is wrong or problematic. Write 1-2 direct sentences that a reviewer can scan without re-reading. Lead with what's wrong, then state what's correct or expected. Avoid filler ("It appears that...", "There seems to be..."): state the problem directly. Examples: "Revenue is stated as $28T but publicly reported figures show $25.5T for 2023." / "The word 'acheived' is misspelled." / "Page 3 says 'founded in 2015' but page 7 says 'celebrating 10 years' in 2023, which implies 2013."
- The suggested replacement for the text. It should closely resemble the original but with the issue fixed.
- The section and the location, as for claims.
- When an error cascades, the earlier issue that caused it. For example, page 1 says "U.S. population is 200 million" (wrong), then page 2 says "10% of the U.S. population is 20 million"; the math is correct for the stated figure but based on the wrong number from page 1, so the second issue points to the first. Leave it out when the issue is independent.

### Issue Types

- `spelling_grammar`: Misspelled words and grammatical errors.
  - IS: "acheived" → "achieved" (misspelling)
  - IS: "A total of $100 millions dollars" (grammar: "millions" → "million")
  - IS: "the the report" (repeated word)
  - IS: "Their going to expand" ("Their" → "They're")
  - NOT: Wrong dates, wrong numbers, backwards timelines (→ `narrative_logic`)
  - NOT: Redundant or nonsensical titles/headings (→ `narrative_logic`)
  - NOT: Real names used instead of code names (→ `non_public_info`)
  - **Test**: Could a spell-checker or grammar-checker catch this? If yes → `spelling_grammar`. If it requires understanding meaning or context → it's another type.

- `narrative_logic`: Logical errors, contradictions, timeline problems, nonsensical content, or structural issues that require understanding meaning to detect.
  - IS: "Founded in 2015" on page 3 but "celebrating 10 years" in 2023 (contradiction)
  - IS: "Expected to grow from 500 in 2025 to 600 in 2020" (backwards timeline)
  - IS: "Comparable Comps Analysis" (tautological: "Comparable" and "Comps" mean the same thing)
  - IS: "Fitness Industry Page" as a section title ("Page" is redundant; the audience already knows it's a page)
  - IS: Document dated January but references "Q4 results" as if complete (impossible timeline)
  - IS: A section header that contradicts the document's own conventions or makes no sense
  - NOT: Misspelled words (→ `spelling_grammar`)
  - NOT: Confidential information leaks (→ `non_public_info`)
  - **Test**: Does this require understanding what the words mean (dates, logic, context) to spot the error? If yes → `narrative_logic`.

- `non_public_info`: Confidential information that should not appear in the document.
  - IS: Using real company names instead of code names (e.g., "Planet Fitness" when code name is "Pluto")
  - IS: Individual salaries, SSNs, private email addresses, phone numbers
  - IS: Unreleased product details, internal strategies, board deliberations
  - IS: "STRICTLY CONFIDENTIAL" or "INTERNAL USE ONLY" markers left in a public-facing document
  - NOT: Misspelled names (→ `spelling_grammar`)
  - NOT: Contradictions about confidential info (→ `narrative_logic`)
  - **Test**: Is the problem that confidential or private information is exposed? If yes → `non_public_info`.

- `verify_public_data`: Facts that differ from verifiable external sources. Requires a search to verify.
  - IS: "U.S. GDP was $28T" but actual is $25T (refuted → create issue)
  - IS: "The treaty was signed in 2018" (actually 2016) (refuted → create issue)
  - IS: "2024 Q4 results were $45M" but no public data available yet (inconclusive → create issue)
  - IS: A verse quoted with different wording than get_verses returns, or given the wrong surah and ayah number (refuted → create issue)
  - IS: A hadith attributed to the wrong collection, or a companion's saying presented as the Prophet's ﷺ words (refuted → create issue)
  - NOT: Dates that contradict other dates within the document (→ `narrative_logic`)

- `numerical_consistency`: Math errors using the document's own numbers. Requires calculation to verify.
  - IS: "Region A: 500 + Region B: 300 = 900" (should be 800) (refuted → create issue)
  - IS: "40% of 1,000 = 500" (should be 400) (refuted → create issue)
  - IS: "$2.4M budget / 12 months = $150K/month" (should be $200K/month) (refuted → create issue)
  - NOT: A timeline going backwards (→ `narrative_logic`)

### Severity Levels

- `high`: Consequences beyond the document: could lead to wrong decisions, legal exposure, or real-world harm (e.g., materially wrong financials, leaked PII, verifiably false facts with regulatory implications, a misquoted verse or hadith)
- `medium`: Undermines the document's credibility: a reader who notices would question whether the rest of the document can be trusted (e.g., internal contradictions, calculation errors, timeline inconsistencies)
- `low`: Undermines professionalism only: looks sloppy but doesn't mislead or cause harm (e.g., typos, grammar errors, repeated words)

## Which Issue Types

Before starting, determine which issue types are relevant from the user's request. When in doubt, default to all 5 types. Examples:

- "review this", "audit this" → all 5 types
- "spell-check this", "proofread this", "check for typos" → `spelling_grammar`
- "fact-check this", "verify the numbers" → `verify_public_data`, `numerical_consistency`
- "check for confidential info" → `non_public_info`

## Document Type

Before starting the workflow, read the document and determine its type (e.g., "investment memo", "research paper", "marketing proposal", "legal contract", "khutbah"). The type sets the severity calibration and which claims matter most.

## Workflow

Execute the phases in order. Skip phases only when their conditions below allow it:

1. **Create sections**: Analyze document structure and divide into thematic sections
2. **Create claims**: Identify fact-checkable statements
   - Skip if only `spelling_grammar`, `narrative_logic`, and/or `non_public_info` requested
3. **Update claims**: Fact-check claims and update their status
   - Skip if Phase 2 was skipped or no claims were created
4. **Create issues**: Review sections for problems and create issues
   - Only create issues for the requested types
5. **Report**: Summarize the findings

Search tools are only for Phase 3 (fact-checking claims). Do not use them in any other phase.

### Phase 1 (Create sections)

Read the entire document and divide it into thematic sections. Sections define the units of work for all later phases; claims are extracted per section, issues are created per section, so getting the boundaries right here determines the quality of everything downstream.

Read the document end-to-end before creating sections. Look for natural thematic boundaries: topic shifts, headings, or transitions between distinct subject areas. Name each section descriptively (e.g., "Market Analysis", "Risk Factors", not "Section 3" or "Pages 5-8"). For XLSX, each section typically corresponds to one worksheet; use the sheet name as the section name. Make all sections together: they must cover every page or sheet with no gaps or overlaps.

Section limits:

- 1 to 4 pages (or sheets): max 2 sections
- 5 to 8 pages (or sheets): max 4 sections
- 9+ pages (or sheets): max 8 sections

### Phase 2 (Create claims)

Scan every section for statements that need external verification or calculation, and note a claim for each one. Claims exist only for facts that cannot be confirmed by reading the document alone.

**Create a claim when** the statement requires:

- **A search** (`verify_public_data`): statistics, dates, published data, attributed facts, or quoted verses and hadith that must be checked against external sources
- **Calculation** (`numerical_consistency`): arithmetic using numbers from the document (sums, percentages, ratios, growth rates) that must be computed to verify

**Do NOT create a claim when** the problem is detectable by reading the document:

- Timeline impossibilities, internal contradictions, or logical errors (catch as `narrative_logic` issues in Phase 4)
- Spelling errors, typos, grammar mistakes, formatting problems (catch as `spelling_grammar` issues in Phase 4)
- Statements that don't need verification (headers, generic text, opinions)

Process every section.

### Phase 3 (Update claims)

Fact-check each claim with search_web, fetch_url and get_verses, and calculations, then settle each claim's status.

**Search**: Fact-check `verify_public_data` claims against external sources. Use short, keyword-focused queries; longer queries reduce result quality. A search takes up to three queries: give a primary query together with a few reformulations to broaden coverage.

- Start broad: a single search can verify multiple related claims (e.g., searching for a company's annual report may confirm revenue, headcount, and founding date at once). Narrow queries to target specific claims only after broad searches leave gaps.
- **Year selection**: Always include the year in queries (e.g., "U.S. GDP 2023" not just "U.S. GDP"). Check the document date first (headers, footers, "as of" statements) and search for data from the year the document references. If unclear, use the most recent complete year before today's date. Don't mix years.
- Prefer authoritative sources when relevant (e.g., SEC filings, investor relations pages on company domains).
- Break multi-entity questions into separate single-entity queries.
- A quoted verse: look it up with get_verses by its reference and compare the wording and the reference. A quoted hadith: search the hadith sources and compare the wording, the collection and the number. Follow the citation rules in your prompt, and give a hadith's grade only from a source.
- When the document states a ruling, do not judge it yourself: say what your sources say about it and cite them. When the schools differ, name each school only from a source in front of you.
- Be pragmatic: if a claim cannot be verified after 2-3 search attempts with different query formulations, mark it as inconclusive and move on. Do not spend unlimited turns chasing a single claim.

**Calculation**: Verify `numerical_consistency` claims with exact values from the document. **NEVER do mental math**: when you have code_execution, use it for every calculation. When you don't, work each one out step by step and say so.

- Examples:
  - 500 + 300 → verify "500 + 300 = 800"
  - 0.40 × 1000 → verify "40% of 1,000 = 400"
  - 2.4 / 12 → verify "$2.4M / 12 months = $200K"
  - (125 - 100) / 100 × 100 → verify "25% growth from 100 to 125"

**Statuses:**

- **Verified**: Confirmed accurate. Exact values must match exactly; approximations (~, approximately, about) allow 5% variance.
- **Refuted**: Contradicted by search results or calculations. If you find clear data that contradicts the claim, mark as refuted, not inconclusive.
- **Inconclusive**: Cannot be verified. Mark as inconclusive only when no reliable data exists after multiple search attempts, results genuinely conflict, or data is not yet available (e.g., future periods).

### Phase 4 (Create issues)

Re-read each section and identify every problem: spelling errors, logical contradictions, confidential information leaks, and any issues from refuted or inconclusive claims. This is a fresh pass through the document, not just a conversion of claims to issues. Only create issues for the requested types (see Which Issue Types).

Go one section at a time, in document order. Categorize each issue by its actual nature (see Issue Types in Definitions). Never force an issue into a type just because the user's request mentioned that type.

- **MANDATORY**: Create issues for ALL refuted and inconclusive claims (100% conversion rate). Preserve the claim's type (`verify_public_data` → `verify_public_data` issue, `numerical_consistency` → `numerical_consistency` issue). For inconclusive claims, explain why verification failed (e.g., "Data not publicly available", "Conflicting sources found", "Not found in the hadith sources searched").
- When you set an earlier issue as the cause of a later one, link cascading errors back to the root issue that caused them.
- Never mention claims in issue descriptions: claims are working notes; issues are what the user reads.

### Phase 5 (Report)

Write the summary as your answer. In a chat, write it to a file with create_text_file only when the user asks for one.

**Summary format:**

1. Opening line: confirm review completion, coverage, and total issue count
2. Claims summary (skip if no claims were created):
   - Total claims checked, broken down by status (e.g., "Verified 42 of 49 claims, 5 refuted, 2 inconclusive")
3. Issues tables: one table per severity level, each with a heading (e.g., **High-Severity Issues**):

**High-Severity Issues**

| Location | Type        | Issue                    | Finding                                     |
| -------- | ----------- | ------------------------ | ------------------------------------------- |
| p. 3     | Public Data | Revenue stated as $28T   | Publicly reported figure is $25.5T for 2023 |
| p. 7     | Numerical   | Region totals sum to 900 | Correct sum is 800 (500 + 300)              |

**Medium-Severity Issues**

| Location | Type            | Issue                     | Finding                                   |
| -------- | --------------- | ------------------------- | ----------------------------------------- |
| p. 3     | Narrative/Logic | Backwards projection year | "to $55-60B by 2020": 2020 is in the past |

**Low-Severity Issues**

| Location | Type             | Issue              | Finding                                           |
| -------- | ---------------- | ------------------ | ------------------------------------------------- |
| p. 5     | Spelling/Grammar | "Comparable Comps" | Tautological: "Comps" already means "Comparables" |

4. Closing line: say what you did not check.

**Tone**: Professional, constructive, and solution-focused. Frame issues as opportunities for improvement rather than failures.
