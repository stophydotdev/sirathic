# Sirathic infrastructure images

Thin, independently deployable infrastructure for Sirathic's external search,
crawl, and cache dependencies. It lives in this repository so client and
infrastructure changes can be reviewed together, but the services do not share
a runtime lifecycle with the Sirathic API.

## Images

- `sirathic-searxng`: three measured web engines plus Wolfram Alpha, bounded
  timeouts, JSON output, and runtime Decodo injection for every engine. Its
  Granian WSGI worker has 32 blocking threads so concurrent searches do not
  queue behind the image's
  four-thread default, backed by a 200-connection HTTP pool with 100 keepalive
  slots for concurrent engine fan-out.
- `sirathic-crawl4ai`: text-oriented browser defaults and a direct-first proxy
  fallback list rendered from runtime secrets.
- `sirathic-camoufox`: a private remote Playwright browser for AI agents.
- `sirathic-firecrawl`: the self-hosted crawl API and its browser worker.
- `sirathic-tailscale`: a private tailnet gateway to Railway services, with
  fixed TCP mappings and persistent node identity.
- `cache`: a disposable Valkey-compatible Redis service used by the Sirathic API
  for SearXNG results and cleaned Crawl4AI evidence. Local Compose caps it at
  512 MB with LFU eviction and intentionally disables persistence.

Both upstream bases are pinned by digest. Renovate or a deliberate maintenance
change should update the digest; never change them to `latest` in production.

## Runtime secrets

Set `DECODO_PROXY_URL` independently on both deployments. It must be a complete
credentialed URL, for example `https://user:password@gate.decodo.com:10000`.
Credentials are rendered only into the container's writable runtime layer and
are never copied into an image.

The renderers normalize the endpoint to an HTTP CONNECT proxy. This is required
even when Railway's credential variable uses an `https://` prefix; passing that
scheme directly to httpx makes it attempt unsupported TLS with the proxy itself.

For Crawl4AI, `DECODO_FETCH_PORTS` defaults to `10001,10002,10003`. A page starts
direct, then retries through stable proxy sessions. SearXNG uses the endpoint in
`DECODO_PROXY_URL`, normally Decodo's rotating residential port `10000`.

Startpage, DuckDuckGo, and Mojeek are the measured residential-proxy web pool.
Startpage had the best combination of relevance, latency, and exact single-domain
`site:` filtering. Mojeek was the only engine to respond to every query in the
sequential benchmark and provides an independent index, though it degraded under
concurrency. DuckDuckGo returned high-quality normal and exact-domain results
with occasional CAPTCHA failures. The combined pool retained a 100% useful-result
and expected-source hit rate in both sequential and five-concurrent tests.
Google, Bing, Brave, Yahoo, Qwant, Yandex, Yep, and the tested regional and small
indexes are excluded after CAPTCHA, rate-limit, empty anti-bot responses,
protocol, domain-filtering, relevance, or reliability failures.

Google provides autocomplete suggestions only; it is not enabled as a search
engine because the residential exits consistently receive its CAPTCHA. The
no-key Wolfram Alpha engine is available explicitly with `!wa` or
`engines=wolframalpha` for computational and factual queries. It is excluded
from ordinary searches because its proxy timeout materially increases latency
under concurrency.

Startpage and Mojeek receive a 1.6-second budget; DuckDuckGo receives 2 seconds.
The engines run in parallel. The 2.8-second maximum accommodates an explicit
Wolfram Alpha request through the proxy without extending normal web engines.

Only the `general` category is loaded. Image, video, news, map, music, social,
torrent, and other vertical engines remain unavailable to keep search output
text-focused and bound the long-term latency and proxy cost.

Engine suspensions are capped at one second. A rotating proxy can move the next
request to a healthy exit, so a CAPTCHA or rate limit from one exit must not
disable that engine globally for SearXNG's multi-hour default.

Sirathic should reach both services through private networking:

```dotenv
SEARXNG_URL=http://searxng.internal:8080
CRAWL4AI_URL=http://crawl4ai.internal:11235
REDIS_URL=redis://cache.internal:6379
```

## Local development

Local infrastructure has an explicit lifecycle separate from the application.
`bun dev` starts only the Sirathic packages, so it can use either these local
services or private Railway endpoints configured in `apps/server/.env`.

The Compose definition lives under `infra/local` to distinguish local
orchestration from the production service images in this directory. Compose
waits on the services' own health checks; no generated container names are used.

```bash
cp infra/.env.example infra/.env
# Add proxy credentials only if proxy-path testing is required.
bun infra:up
redis-cli -u redis://localhost:6379 ping
bun search "what is islam"
bun dev
```

The Compose file binds SearXNG to `18888` and Crawl4AI to `11235` for local
testing. Production platforms build the two Dockerfiles as separate services.
The SearXNG image also includes `/opt/sirathic/benchmark.py` for internal,
repeatable concurrency and result-quality measurements.

Stop the local services with `bun infra:down`.

## Core research tools

The development probes live beside the core module they exercise while their
short root commands remain stable:

```bash
bun search "salah times"                           # SearXNG, no LLM
bun query "why do Muslims pray five times a day?"  # complete answer pipeline
```

Search quality evaluation is package-local at
`packages/core/perf/evaluate-search.ts`; it is intentionally not another root
package command.
