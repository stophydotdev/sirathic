# Sirathic infrastructure images

Thin, independently deployable infrastructure for Sirathic's external search,
crawl, and cache dependencies. It lives in this repository so client and
infrastructure changes can be reviewed together, but the services do not share
a runtime lifecycle with the Sirathic API.

## Images

- `sirathic-searxng`: four measured engines, bounded timeouts, JSON output, and
  runtime Decodo injection for every engine. Its Granian WSGI worker has 32
  blocking threads so concurrent searches do not queue behind the image's
  four-thread default, backed by a 200-connection HTTP pool with 100 keepalive
  slots for concurrent engine fan-out.
- `sirathic-crawl4ai`: text-oriented browser defaults and a direct-first proxy
  fallback list rendered from runtime secrets.
- `cache`: a disposable Valkey-compatible Redis service used by the Sirathic API
  for SearXNG results and cleaned Crawl4AI evidence. Local Compose caps it at
  512 MB with LFU eviction and intentionally disables persistence.

Both upstream bases are pinned by digest. Renovate or a deliberate maintenance
change should update the digest; never change them to `latest` in production.

## Runtime secrets

Set `DECODO_PROXY_URL` independently on both deployments. It must be a complete
credentialed URL, for example `https://user:password@dc.decodo.com:10000`.
Credentials are rendered only into the container's writable runtime layer and
are never copied into an image.

The renderers normalize the endpoint to an HTTP CONNECT proxy. This is required
even when Railway's credential variable uses an `https://` prefix; passing that
scheme directly to httpx makes it attempt unsupported TLS with the proxy itself.

For Crawl4AI, `DECODO_FETCH_PORTS` defaults to `10001,10002,10003`. A page starts
direct, then retries through stable datacenter sessions. SearXNG uses the port in
`DECODO_PROXY_URL`, normally Decodo's rotating port `10000`.

Startpage is opportunistic: datacenter exits can still receive its CAPTCHA. Its
timeout is deliberately shorter and it has no retry, so the other proxied
engines can return without waiting through repeated challenges.

Search engines receive a 1.1-second budget. Longer waits did not recover blocked
engines in production testing, so the tighter limit preserves response speed.

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
