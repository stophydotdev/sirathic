# Sirathic Firecrawl

Production images and local orchestration for Sirathic's self-hosted Firecrawl
deployment. Firecrawl is a distributed service: the API image requires the
Playwright service, Redis, RabbitMQ, and its NuQ PostgreSQL image.

## Local verification

All Firecrawl files and commands are contained in this directory.

```bash
bun firecrawl:up

curl -fsS -X POST http://localhost:3002/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","formats":["markdown"]}'

bun firecrawl:down
```

To override the checked-in development defaults, copy `.env.example` to an
ignored `.env` file and run with
`FIRECRAWL_ENV_FILE=infra/firecrawl/.env bun firecrawl:up`.

The API is healthy at `http://localhost:3002/v0/health/readiness`. Local
defaults run two workers and two concurrent browser pages to keep resource use
bounded.

## Railway topology

The Railway template `firecrawl-web-scraping-api` creates these five
independently restartable services in the existing Sirathic project:

| Railway service | Source | Public | Persistent storage |
| --- | --- | --- | --- |
| `firecrawl` | `Dockerfile` | API port `3002` | No |
| `firecrawl-playwright` | `Dockerfile.playwright` | No | No |
| `firecrawl-redis` | Railway Redis | No | Managed |
| `firecrawl-rabbitmq` | pinned RabbitMQ image from `compose.yml` | No | No |
| `firecrawl-postgres` | pinned NuQ PostgreSQL image from `compose.yml` | No | `/var/lib/postgresql/data` |

Sirathic's existing `searxng` service is reused rather than duplicated. Set
`SEARXNG_ENDPOINT` on the Firecrawl API to
`http://${{searxng.RAILWAY_PRIVATE_DOMAIN}}:8080`.

The two Sirathic images build from the repository root with these Dockerfile
paths:

```text
/infra/firecrawl/Dockerfile
/infra/firecrawl/Dockerfile.playwright
```

Set the following runtime variables on `firecrawl` using Railway private-domain
references. Values shown in `${{...}}` form are Railway variable references,
not literal strings to resolve locally.

```dotenv
HOST=0.0.0.0
PORT=3002
ENV=local
USE_DB_AUTHENTICATION=false
REDIS_URL=${{firecrawl-redis.REDIS_URL}}
REDIS_RATE_LIMIT_URL=${{firecrawl-redis.REDIS_URL}}
PLAYWRIGHT_MICROSERVICE_URL=http://${{firecrawl-playwright.RAILWAY_PRIVATE_DOMAIN}}:3000/scrape
NUQ_RABBITMQ_URL=amqp://${{firecrawl-rabbitmq.RAILWAY_PRIVATE_DOMAIN}}:5672
POSTGRES_HOST=${{firecrawl-postgres.RAILWAY_PRIVATE_DOMAIN}}
POSTGRES_PORT=5432
POSTGRES_USER=${{firecrawl-postgres.POSTGRES_USER}}
POSTGRES_PASSWORD=${{firecrawl-postgres.POSTGRES_PASSWORD}}
POSTGRES_DB=${{firecrawl-postgres.POSTGRES_DB}}
NUM_WORKERS_PER_QUEUE=2
CRAWL_CONCURRENT_REQUESTS=2
MAX_CONCURRENT_JOBS=2
BROWSER_POOL_SIZE=2
BULL_AUTH_KEY=<strong-random-secret>
```

Set these variables on `firecrawl-playwright`:

```dotenv
PORT=3000
MAX_CONCURRENT_PAGES=2
BLOCK_MEDIA=true
PROXY_SERVER=<optional-proxy-endpoint>
PROXY_USERNAME=<optional-proxy-username>
PROXY_PASSWORD=<optional-proxy-password>
```

Set `POSTGRES_USER=postgres`, `POSTGRES_DB=postgres`, and a strong
`POSTGRES_PASSWORD` on `firecrawl-postgres`. The pinned NuQ image configures
`pg_cron` for the `postgres` database; changing the database name prevents the
queue schema from initializing.

On Railway, mount the NUQ PostgreSQL volume at `/var/lib/postgresql/data` and
set `PGDATA=/var/lib/postgresql/data/pgdata`. Railway volumes contain a
`lost+found` directory at their root, so PostgreSQL must initialize in this
subdirectory.

Only `firecrawl` needs a Railway domain. Use `/v0/health/readiness` as its
health-check path. Keep Playwright, Redis, RabbitMQ, and PostgreSQL private.

## Image maintenance

All upstream images are pinned by multi-architecture digest. Update Firecrawl,
Playwright, and NuQ PostgreSQL together, then rerun the local scrape smoke test
before deploying. Self-hosted Firecrawl does not include Fire-engine, so proxy
quality remains important for sites with strong anti-bot protection.
