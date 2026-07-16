import os
import re
from urllib.parse import unquote, urlsplit

from camoufox.server import launch_server


def required_ws_path() -> str:
    value = os.environ.get("CAMOUFOX_WS_PATH", "").strip().strip("/")
    if len(value) < 32 or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise SystemExit(
            "CAMOUFOX_WS_PATH must be at least 32 characters using only letters, numbers, _ or -"
        )
    return value


def proxy_config() -> dict[str, str] | None:
    raw = os.environ.get("CAMOUFOX_PROXY_URL", "").strip()
    if not raw:
        return None

    parsed = urlsplit(raw)
    if not parsed.scheme or not parsed.hostname or not parsed.port:
        raise SystemExit("CAMOUFOX_PROXY_URL must include a scheme, host, and port")

    proxy = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
    if parsed.username:
        proxy["username"] = unquote(parsed.username)
    if parsed.password:
        proxy["password"] = unquote(parsed.password)
    return proxy


if __name__ == "__main__":
    proxy = proxy_config()
    launch_server(
        headless=True,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "3000")),
        ws_path=required_ws_path(),
        proxy=proxy,
        geoip=bool(proxy),
        humanize=True,
        fingerprint_preset=True,
        os="windows",
    )
