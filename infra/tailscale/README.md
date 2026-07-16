# Sirathic Tailscale gateway

Private TCP gateway from the Sirathic Tailscale network to services on
Railway's private network. The image uses `tsnet`, so it does not require a
TUN device or privileged container access.

The upstream image is pinned by its multi-architecture digest. Do not replace
the digest with `latest` in production.

## Railway service

Create a service named `tailscale` from this repository on the `main` branch.
Build it with `infra/tailscale/Dockerfile`, keep it private, and attach a
persistent volume at `/data` so the node keeps the same Tailscale identity
across deployments.

Set these variables:

```dotenv
TS_AUTHKEY=<reusable, non-ephemeral Tailscale auth key>
TS_HOSTNAME=sirathic-production
TS_STATE_DIR=/data
TS_EPHEMERAL=false
CONNECTION_MAPPING_01=3002:${{Firecrawl API.RAILWAY_PRIVATE_DOMAIN}}:${{Firecrawl API.PORT}}
CONNECTION_MAPPING_02=3003:${{camoufox.RAILWAY_PRIVATE_DOMAIN}}:8080
CONNECTION_MAPPING_03=8080:${{searxng.RAILWAY_PRIVATE_DOMAIN}}:${{searxng.PORT}}
CONNECTION_MAPPING_04=3004:${{Firecrawl Playwright.RAILWAY_PRIVATE_DOMAIN}}:${{Firecrawl Playwright.PORT}}
CONNECTION_MAPPING_05=6379:${{Redis.RAILWAY_PRIVATE_DOMAIN}}:${{Redis.REDISPORT}}
CONNECTION_MAPPING_06=5432:${{NUQ-Postgres.RAILWAY_PRIVATE_DOMAIN}}:${{NUQ-Postgres.POSTGRES_PORT}}
CONNECTION_MAPPING_07=5672:${{RabbitMQ.RAILWAY_PRIVATE_DOMAIN}}:${{RabbitMQ.RABBITMQ_PORT}}
```

`TS_AUTHKEY` is a secret and must exist only in Railway. Generate it in the
Tailscale admin console with **Reusable** enabled and **Ephemeral** disabled.
Use Tailscale ACLs or grants to restrict which users and agent nodes can reach
the gateway ports.

## Tailnet endpoints

With MagicDNS enabled, clients on the tailnet connect to the gateway hostname
and the mapped port:

| Service | Endpoint |
| --- | --- |
| Firecrawl API | `http://sirathic-production:3002` |
| Camoufox | `ws://sirathic-production:3003/<CAMOUFOX_WS_PATH>` |
| SearXNG | `http://sirathic-production:8080` |
| Firecrawl Playwright | `http://sirathic-production:3004` |
| Redis | `redis://sirathic-production:6379` |
| NUQ Postgres | `postgresql://sirathic-production:5432` |
| RabbitMQ | `amqp://sirathic-production:5672` |

Authentication required by each backend remains in force. In particular,
Camoufox still requires `CAMOUFOX_WS_PATH`, Redis still requires its password,
and the databases retain their existing credentials.
