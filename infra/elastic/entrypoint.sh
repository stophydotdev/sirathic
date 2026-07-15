#!/usr/bin/env bash
set -euo pipefail

readonly elasticsearch_url="${ELASTICSEARCH_URL:-http://127.0.0.1:9200}"

/usr/local/bin/docker-entrypoint.sh &
elasticsearch_pid=$!

shutdown() {
  kill -TERM "${elasticsearch_pid}" 2>/dev/null || true
  wait "${elasticsearch_pid}" 2>/dev/null || true
}
trap shutdown TERM INT

for attempt in $(seq 1 120); do
  if curl --fail --silent "${elasticsearch_url}/_cluster/health" >/dev/null; then
    ELASTICSEARCH_URL="${elasticsearch_url}" /opt/sirathic/elastic/init.sh
    wait "${elasticsearch_pid}"
    exit $?
  fi

  if ! kill -0 "${elasticsearch_pid}" 2>/dev/null; then
    wait "${elasticsearch_pid}"
    exit $?
  fi

  sleep 1
done

echo "Elasticsearch did not become healthy within 120 seconds." >&2
shutdown
exit 1
