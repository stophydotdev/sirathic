# Sirathic — Context

> Product context for anyone (human or AI) working in this repo. Keep this current as decisions land.

---

## What we are

Sirathic is an answer engine for Islamic knowledge, modelled on Perplexity's UX but grounded in authenticated primary sources. Every claim in an answer carries a citation. Scholarly disagreement between madhāhib is preserved, not flattened.

The name comes from **al-Ṣirāṭ al-Mustaqīm** (الصراط المستقيم) — the straight path. Read it as the path to a verified answer, not as a claim of religious authority.

---

## Who we serve (v1)

In rough order of priority:

1. **English-speaking Muslims (diaspora + converts)** asking practical questions (fiqh of daily life, aqeedah basics, family law).
2. **Arabic-speaking Muslims** asking the same questions in Arabic, expecting classical citations.
3. **Students of Islamic sciences** (madrasah, university Islamic studies) needing quick orientation with sources to follow up on.
4. **Content creators / teachers** who need to fact-check their own explanations.
5. **Developers / researchers** who want a programmatic surface (SDK + HTTP).

We are not (v1):
- Scholars issuing fatwas. We surface citations; users + their scholars do ijtihad.
- A general-purpose Islamic social network.
- A replacement for asking a local scholar.

---

## Core principles

1. **Cite or skip.** No factual claim without a source pointer. If we can't cite it, we say we don't know.
2. **Surface disagreement.** When Hanafi, Shafiʿi, Maliki, Hanbali, and Shia scholars differ, we say so. We do not pick a winner.
3. **Grade hadith.** `ṣaḥīḥ` / ḥasan / ḍaʿīf / mawḍūʿ are always shown. A `ḍaʿīf` hadith is never the sole evidence for a ruling.
4. **Arabic first, English alongside.** Original Arabic sources are canonical; English translations are bridges.
5. **Reverent, not reverential.** This is a tool. We handle sacred material with care, but we don't pretend to be a religious authority.
6. **Boring infrastructure, sharp UX.** Postgres, bun, TypeScript, Hono. The magic is in retrieval + prompting + source quality.

---

## How we differentiate from Perplexity / ChatGPT

| | Perplexity / ChatGPT | Sirathic |
|---|---|---|
| Source authority | Web (mixed quality) | Authenticated Islamic corpus only |
| Hadith grading | None | Always shown (Bukhari grading, Ibn Ḥajar, etc.) |
| Madhāhib | Flattened | Surfaced side-by-side |
| Arabic | Decent | First-class |
| Citations | Generic URLs | `Sahih al-Bukhari 1901 · graded ṣaḥīḥ · narrated by Salmān al-Fārisī` |
| Fatwa framing | Doesn't issue fatwas | Doesn't issue fatwas (but is explicit about it) |
| Open | Mostly closed | CLI + SDK + open source code |

---

## What lives where (TL;DR)

- `packages/llm` — model provider
- `packages/core/src/tools` — multi-query source search, authority ranking, allowlisted page fetching, and source registry
- `packages/core` — tool-calling research module and grounded answer synthesis
- `apps/server` — Hono HTTP API and SSE research stream
- `apps/web` — Bun-managed Next.js research interface
- `searxng` — the custom SearXNG image Railway builds for Firecrawl; no secrets

### Infrastructure boundary

Firecrawl and SearXNG are externally hosted dependencies, not applications under
`apps`. Railway runs Firecrawl, Playwright, and the Tailscale gateway from
upstream images; Sirathic keeps only its custom SearXNG image under `searxng`.
The API reaches Firecrawl over private networking through `FIRECRAWL_URL`; it
never calls SearXNG or Playwright directly. Do not bundle the API, Firecrawl,
SearXNG, or Redis into one process lifecycle.

A single machine or hosting project is acceptable initially, but each component
must remain an independently restartable service. Infrastructure credentials
must not be committed here. Sirathic may hold service-access credentials in its
deployment environment; upstream proxy credentials should live with the service
that uses them.

### Data and cache boundary

- Redis/Valkey is an externally hosted cache shared by Sirathic instances.
- SearXNG and Firecrawl workers are disposable compute. Their local state must never be
  treated as durable Sirathic data.
- Final LLM answers are never cached. Search results and cleaned source evidence
  are cached; every answer is newly synthesized for the user's exact question.
- Research responses expose the model's generated query plan, the trusted
  queries actually executed, every ranked/clickable discovery returned by the
  search tool, and the smaller fetched evidence set used for citations. A
  discovered link must never be presented as if its page was read.

Cache keys include the normalized query or canonical URL plus extraction and
source-registry versions. Concurrent misses for the same key are coalesced.
Frequently used keys refresh ahead of expiry. Stale evidence may be served while
it revalidates in the background, and may remain available during a temporary
source or proxy failure.

| Cached evidence | Fresh for | May serve stale for |
|---|---:|---:|
| Qur'an verse pages | 30 days | 1 year |
| Sunnah/hadith pages | 30 days | 1 year |
| IslamQA and other fatwa answers | 7 days | 90 days |
| Yaqeen/SeekersGuidance and scholarly articles | 3 days | 30 days |
| General evergreen pages | 24 hours | 7 days |
| Evergreen search results | 6–12 hours | 3 days |
| Current or time-sensitive search results | 5–15 minutes | 1 hour |
| 403/429 failures | 2–10 minutes | never |
| 404 responses | 1–6 hours | never |

Qur'an and hadith extraction should be content-addressed: a canonical URL points
to its latest content hash, and the hash points to cleaned markdown. A successful
revalidation with the same hash updates only `checkedAt`. Redis/Valkey loss is a
performance event, not a correctness or durability event; all cached evidence
must be safely rebuildable from its cited URL.

---

## Source-of-truth ranking

When sources disagree (and they will):

1. **Qur'an** — direct ayah > paraphrase
2. **Muttafaqun ʿalayh** hadith (Bukhari + Muslim) — graded ṣaḥīḥ by agreement
3. **Sahih** hadith in one of the six books — Bukhari > Muslim > Abu Dawud > Tirmidhi > Nasa'i > Ibn Majah
4. **Hasan** hadith
5. **Athar** (sayings of Companions)
6. **Ijmaʿ** (scholarly consensus) — when consensus actually exists
7. **Qiyas** (analogy) and contemporary ijtihad — clearly attributed to a named scholar
8. **Tafsir** — author + book + volume/page always cited

We never collapse the chain. The user sees exactly which link of evidence the answer rests on.

---

## Citation format (canonical)

Inline `[n]` markers. Footnote block at end. Example:

```
[1]  Qur'an 2:183 — Translation: Sahih International
     ↳ Tafsir Ibn Kathir 1/205
[2]  Sahih al-Bukhari 1901 — Narrated by Salman al-Farisi (رضي الله عنه)
     ↳ Graded ṣaḥīḥ · Chain: ʿUqayl → al-Zuhri → Abū al-Dardāʾ → Salmān
[3]  Tafsir al-Tabari 2/300 — via Altafsir.com
[4]  IslamQA Fatwa #12345 — Shaykh Muhammad Salih al-Munajjid
     ↳ Hanbali · issued 2004-03-15
```

Every entry must have a machine-resolvable source id. If it doesn't, it doesn't ship.

---

## Voice

For UI strings and system prompts:

- Direct, plain. No flowery Arabic, no baroque English.
- No emoji in answers.
- Disagreement phrases: "Most scholars hold ...", "The Hanafi school holds ...", "There is scholarly disagreement on this point — see [1] and [2]."
- Disclaimer footer (always present): *"This is information, not legal or religious advice. Verify with a qualified scholar."*

---

## What this document is for

This is the **north star**. When you're not sure whether a feature fits, whether a prompt is on-brand, whether a citation is acceptable — read this first, then `PLAN.md` for the structural view.

Update this file when a principle changes. Don't update it for tactical decisions — those go in `PLAN.md` or in package-level READMEs.
