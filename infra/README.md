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

## Local verification

```bash
cp infra/.env.example infra/.env
# Add proxy credentials only if proxy-path testing is required.
docker compose --env-file infra/.env -f infra/compose.yml up --build -d
redis-cli -u redis://localhost:6379 ping
bun --env-file=apps/server/.env scripts/smoke-search.ts "what is islam"
bun --env-file=apps/server/.env scripts/smoke-fetch.ts https://quran.com/2/183
```

The Compose file binds SearXNG to `18888` and Crawl4AI to `11235` for local
testing. Production platforms build the two Dockerfiles as separate services.
The SearXNG image also includes `/opt/sirathic/benchmark.py` for internal,
repeatable concurrency and result-quality measurements.
