# Sirathic Camoufox

Private remote browser for AI agents. It runs Camoufox as an experimental
Playwright WebSocket server; clients control it with Playwright's Firefox
`connect()` API.

`CAMOUFOX_WS_PATH` is the access secret. It must contain at least 32 URL-safe
characters and must never be committed. Keep the Railway service private unless
agents outside the Railway project need to connect.

## Local smoke test

```bash
export CAMOUFOX_WS_PATH="$(openssl rand -hex 32)"
docker build -f infra/camoufox/Dockerfile -t sirathic/camoufox:local .
docker run --rm -d --name sirathic-camoufox \
  -e CAMOUFOX_WS_PATH="$CAMOUFOX_WS_PATH" \
  -p 3003:3000 sirathic/camoufox:local

CAMOUFOX_WS_ENDPOINT="ws://127.0.0.1:3003/$CAMOUFOX_WS_PATH" \
  uv run --project infra/camoufox python infra/camoufox/smoke_test.py
```

For Railway, set `CAMOUFOX_WS_PATH` to a strong random value. Agents in the
project connect to:

```text
ws://${{camoufox.RAILWAY_PRIVATE_DOMAIN}}:${{camoufox.PORT}}/<CAMOUFOX_WS_PATH>
```

Set `CAMOUFOX_PROXY_URL` to a complete proxy URL when browser traffic should use
a proxy. Camoufox derives geolocation and locale from that proxy.

The upstream remote-server feature is experimental and one service instance
hosts one browser process with one fingerprint. Scale by creating isolated
services or rotating instances, not by adding replicas behind one load-balanced
WebSocket endpoint.
