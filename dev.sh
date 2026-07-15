#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose --env-file infra/.env -f infra/compose.yml)

echo "Starting Sirathic infrastructure..."
"${compose[@]}" up --build -d

echo "Waiting for Redis, SearXNG, and Crawl4AI..."
for _ in $(seq 1 45); do
  cache_status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' sirathic-infra-cache-1 2>/dev/null || true)
  searxng_status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' sirathic-infra-searxng-1 2>/dev/null || true)
  crawl4ai_status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' sirathic-infra-crawl4ai-1 2>/dev/null || true)
  if [[ "$cache_status" == "healthy" && "$searxng_status" == "healthy" && "$crawl4ai_status" == "healthy" ]]; then
    break
  fi
  sleep 1
done

if [[ "$cache_status" != "healthy" || "$searxng_status" != "healthy" || "$crawl4ai_status" != "healthy" ]]; then
  echo "Infrastructure did not become healthy. Run: docker compose -f infra/compose.yml ps" >&2
  exit 1
fi

echo "Warming trusted search..."
search_ready=false
for _ in $(seq 1 20); do
  payload=$(curl -fsS --max-time 3 --get http://127.0.0.1:18888/search \
    --data-urlencode 'q=what is islam site:quran.com' \
    --data-urlencode 'language=en' \
    --data-urlencode 'categories=general' \
    --data-urlencode 'format=json' 2>/dev/null || true)
  if grep -Eq '"results"[[:space:]]*:[[:space:]]*\[[[:space:]]*\{' <<<"$payload"; then
    search_ready=true
    break
  fi
  sleep 1
done

if [[ "$search_ready" != true ]]; then
  echo "SearXNG is healthy but trusted search is not returning results." >&2
  exit 1
fi

echo "Infrastructure ready. Starting API on :3000 and web on :3001..."
exec ./node_modules/.bin/turbo dev
