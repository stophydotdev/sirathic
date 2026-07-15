#!/usr/bin/env bash
set -euo pipefail

readonly elasticsearch_url="${ELASTICSEARCH_URL:-http://elastic:9200}"
readonly templates_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/templates" && pwd)"

put_file() {
  local endpoint="$1"
  local file="$2"

  curl --fail --silent --show-error \
    --request PUT \
    --header "Content-Type: application/json" \
    --data-binary "@${file}" \
    "${elasticsearch_url}/${endpoint}" >/dev/null
}

put_language_template() {
  local language="$1"
  local analyzer="$2"

  sed \
    -e "s/__LANGUAGE__/${language}/g" \
    -e "s/__ANALYZER__/${analyzer}/g" \
    "${templates_dir}/language-index.json" |
    curl --fail --silent --show-error \
      --request PUT \
      --header "Content-Type: application/json" \
      --data-binary @- \
      "${elasticsearch_url}/_index_template/sirathic-passages-${language}" >/dev/null
}

put_file "_component_template/sirathic-passages-common" "${templates_dir}/common-component.json"
put_file "_index_template/sirathic-passages-fallback" "${templates_dir}/fallback-index.json"

while read -r language analyzer; do
  put_language_template "${language}" "${analyzer}"
done <<'LANGUAGES'
ar arabic
bn bengali
en english
fa persian
fr french
id indonesian
ms standard
ru russian
es spanish
tr turkish
ur standard
LANGUAGES

echo "Installed Sirathic Elasticsearch passage templates."
