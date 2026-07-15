#!/bin/sh
set -eu

python /opt/sirathic/render_config.py

exec "$@"

