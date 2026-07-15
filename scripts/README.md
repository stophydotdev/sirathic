# scripts

Runnable smoke tests and local infra helpers. These exercise the real packages
against the real services — not unit tests, but the fastest way to confirm the
ingestion plumbing works end to end.

## Infrastructure

SearXNG and Crawl4AI are hosted separately and are not managed by this
repository. Set `SEARXNG_URL` and `CRAWL4AI_URL` in `apps/server/.env` to their
private endpoints before running these scripts. Their proxy credentials and
operational configuration belong to those external deployments.

## Commands

```bash
bun query "why do Muslims pray five times a day?"  # full researched answer
bun search "salah times"                  # trusted SearXNG search, no LLM
```

`query` runs the complete research and answer pipeline. `search` runs three
deterministic evidence lanes through SearXNG and the trusted ranker; it never
calls an LLM. `SEARXNG_URL` selects the external endpoint.

The internal `evaluate-search.ts` runner remains available for reviewed quality
checks without adding another package command.

## What to look for

- **fetch:** each result prints the Crawl4AI mode and elapsed time. Proxy routing
  is intentionally opaque to Sirathic and belongs to the external deployment.
- **search:** each query prints elapsed time, result count, and any degraded
  engine with its reason. Startpage CAPTCHA errors should disappear when the
  proxy runtime config is active.
