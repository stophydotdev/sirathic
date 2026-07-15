import os
from pathlib import Path
from urllib.parse import unquote, urlsplit

import yaml


source = Path("/opt/sirathic/config.yml")
target = Path("/app/config.yml")
config = yaml.safe_load(source.read_text())
raw_proxy = os.environ.get("DECODO_PROXY_URL", "").strip()

if raw_proxy:
    parsed = urlsplit(raw_proxy)
    if not parsed.scheme or not parsed.hostname or not parsed.username or not parsed.password:
        raise SystemExit("DECODO_PROXY_URL must include scheme, host, username, and password")

    ports = []
    for value in os.environ.get("DECODO_FETCH_PORTS", "10001,10002,10003").split(","):
        try:
            port = int(value.strip())
        except ValueError:
            continue
        if 1 <= port <= 65535:
            ports.append(port)
    if not ports:
        raise SystemExit("DECODO_FETCH_PORTS contains no valid ports")

    proxies = ["direct"]
    proxies.extend(
        {
            "server": f"{parsed.scheme}://{parsed.hostname}:{port}",
            "username": unquote(parsed.username),
            "password": unquote(parsed.password),
        }
        for port in ports
    )
    config["crawler"]["base_config"]["proxy_config"] = proxies

target.write_text(yaml.safe_dump(config, sort_keys=False))
target.chmod(0o600)

