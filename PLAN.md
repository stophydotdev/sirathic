# Sirathic — Current Plan

> A citation-first Islamic research agent: parallel source discovery, grounded synthesis, and explicit scholarly disagreement.

## Current architecture

Sirathic does not depend on a prebuilt corpus or vector RAG system to answer questions. A deterministic trusted-source planner starts multiple queries immediately, ranks the results, fetches the best pages, and then a synthesis model answers using only the gathered evidence. We do not spend an LLM call on query planning: it added roughly four seconds while the trust router replaced its output anyway.

```text
Question
  -> trusted query planner (no extra model call)
       -> searchSources(3–5 parallel single-domain evidence lanes)
       -> authority ranking + URL deduplication
       -> fetchSources(top 3 URLs)
       -> optionally fetch 1–2 more when evidence is insufficient
  -> normalized evidence with provenance
  -> answer model
  -> answer with inline citations + source objects
```

This is application-orchestrated retrieval: explicit search and fetch tools control what is read, while the LLM is reserved for evidence-grounded synthesis. A vector index is not a prerequisite. We will add local indexing only when evaluations show that direct sources cannot reliably retrieve a required class of evidence.

## What is implemented

- Three-query speed/balanced research and five-query quality research, executed in parallel.
- Intent-routed expert lanes for madhhab, counseling, practical guidance,
  finance, Arabic, and general rulings; each query uses one domain because
  search engines drop combined multi-domain `site:` expressions.
- Canonical URL deduplication and authority-aware ranking across query results.
- Allowlisted discovery restricted to citable Tier A/B domains; Tier C and off-list results are excluded.
- Three-page parallel fetching with direct-HTML first, Crawl4AI static/browser fallback, and up to two adaptive extra fetches.
- Each completed search lane may speculatively begin fetching its best trusted page while the other lanes finish; only the final global ranking becomes citable evidence.
- Search transparency returns the executed query plan and every ranked discovery separately from fetched citation evidence.
- Clickable source metadata including canonical URL, domain, and favicon.
- Grounded answer synthesis restricted to gathered evidence.
- CLI answer flow and `POST /v1/ask` JSON API.
- Behavioral tests for direct source tools and the HTTP answer surface.

## Trust rules

1. The answer model may use only normalized evidence gathered by tools.
2. Web-search snippets are leads, not evidence; a page must be fetched before citation.
3. Hadith claims must be supported by the fetched source's explicit reference and grade where available.
4. Every evidence object carries a canonical reference or source URL.
5. Madhhab positions must be attributed to their source; the system does not choose a winner.
6. If the tools do not find sufficient evidence, Sirathic says so.

## Next tracer bullets

1. Evaluate domain-specific Quran, hadith, and Arabic search adapters behind `searchSources` without expanding the public interface.
2. Validate that every answer sentence requiring evidence is supported by its cited source.
3. Add insufficient-evidence and conflicting-scholarly-view cases to the reviewed evaluation corpus.
4. Complete Arabic retrieval coverage and the RTL web experience.
5. Add authentication, rate limits, observability, and query-level cost/latency budgets.

## When local indexing becomes justified

Add a local source index only for material that is unavailable through reliable direct lookup, too slow to fetch live, or repeatedly missed in evaluation. The index remains behind a domain-specific tool such as `searchClassicalBooks`; it does not become the orchestrator.
