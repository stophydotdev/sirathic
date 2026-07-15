import os
from pathlib import Path
from urllib.parse import urlsplit

import yaml


source = Path("/opt/sirathic/settings.yml")
target = Path("/etc/searxng/settings.yml")
settings = yaml.safe_load(source.read_text())
raw_proxy = os.environ.get("DECODO_PROXY_URL", "").strip()

if raw_proxy:
    parsed = urlsplit(raw_proxy)
    if not parsed.scheme or not parsed.hostname or not parsed.username or not parsed.password:
        raise SystemExit("DECODO_PROXY_URL must include scheme, host, username, and password")

    proxy = raw_proxy.rstrip("/")
    for engine in settings["engines"]:
        if engine["name"] in {"bing", "startpage"}:
            engine["proxies"] = {"http": [proxy], "https": [proxy]}

target.write_text(yaml.safe_dump(settings, sort_keys=False))
target.chmod(0o600)

