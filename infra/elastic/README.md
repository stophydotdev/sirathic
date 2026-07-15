# Sirathic Elasticsearch

This directory defines Sirathic's vector-free lexical index. Elasticsearch is
application-independent infrastructure: PostgreSQL remains the system of record,
while Elasticsearch stores rebuildable, normalized passages used for retrieval.

The Dockerfile is also the production Railway image. Its entrypoint starts
Elasticsearch and idempotently installs the same templates used by local Compose.

## Local use

The root infrastructure command starts Elasticsearch and runs `init.sh` after
the node becomes healthy:

```bash
cp infra/.env.example infra/.env
bun infra:up
curl http://localhost:9200/_cluster/health
curl http://localhost:9200/_index_template/sirathic-passages-en
```

Local Elasticsearch listens on `http://localhost:9200`. Security is disabled
only in the local Compose definition. Do not expose that node publicly or copy
the setting to production.

`ELASTICSEARCH_JAVA_OPTS` controls the local heap and defaults to 1 GB. The data
volume survives `bun infra:down`; use `docker compose --env-file infra/.env -f
infra/local/compose.yml down --volumes` only when intentionally deleting the
local search index.

## Railway

The production service mounts persistent storage at
`/usr/share/elasticsearch/data` and is reachable only through Railway private
networking at `http://elastic.railway.internal:9200`. Elasticsearch security is
disabled because traffic remains inside the project network; never add a public
domain or TCP proxy without first enabling authentication and TLS.

Set `RAILWAY_DOCKERFILE_PATH=/infra/elastic/Dockerfile` on the Railway service so
deployments connected to the monorepo build this image. The entrypoint prepares
Railway's root-owned volume before the upstream Elasticsearch entrypoint drops
to its unprivileged runtime user.

## Index convention

Create versioned indices as `sirathic-passages-{language}-{version}`, for example
`sirathic-passages-en-v1` or `sirathic-passages-ar-v1`. The initializer installs
native analyzers for:

- Arabic (`ar`), Bengali (`bn`), English (`en`), French (`fr`), Indonesian
  (`id`), Persian (`fa`), Russian (`ru`), Spanish (`es`), and Turkish (`tr`)
- Urdu (`ur`) and Malay (`ms`) with the standard analyzer until a tested custom
  analyzer is added

Other language codes receive the standard analyzer through the fallback
template. Keep one language per index so text is analyzed consistently and an
individual language can be rebuilt or re-ranked independently.

The application should query a stable alias such as `sirathic-passages-en`.
Aliases are intentionally not created here because the ingestion/reindexing job
owns atomic version promotion.

## Data ownership

Each Elasticsearch document represents one passage or chunk. `document_id` and
`chunk_number` identify its PostgreSQL parent and position. `content_hash`
supports idempotent indexing. Unknown top-level fields are retained in `_source`
but are not indexed; flexible source-specific values belong in `metadata`.

Use `authority_tier`, `source_role`, `is_primary_source`, and reference fields as
ranking/filtering inputs. They are evidence metadata, not automatic theological
judgments; ingestion must derive them from the reviewed source registry.
