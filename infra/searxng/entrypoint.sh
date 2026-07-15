#!/bin/sh
set -eu

/usr/local/searxng/.venv/bin/python /opt/sirathic/render_settings.py
chown searxng:searxng /etc/searxng/settings.yml

exec /usr/local/searxng/entrypoint.sh

