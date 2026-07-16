import argparse
import json
from urllib.parse import urlencode
from urllib.request import urlopen


def fetch(base_url: str, parameters: dict[str, str]) -> tuple[int, str, bytes]:
    url = f"{base_url.rstrip('/')}/search?{urlencode(parameters)}"
    with urlopen(url, timeout=20) as response:
        return response.status, response.headers.get_content_type(), response.read()


def main() -> None:
    parser = argparse.ArgumentParser(description="Check SearXNG browser and API search formats")
    parser.add_argument("--url", default="http://127.0.0.1:8080")
    args = parser.parse_args()

    html_status, html_type, html_body = fetch(args.url, {"q": "searxng smoke test"})
    json_status, json_type, json_body = fetch(
        args.url, {"q": "searxng smoke test", "format": "json"}
    )
    payload = json.loads(json_body)

    assert html_status == 200, f"HTML search returned {html_status}"
    assert html_type == "text/html", f"unexpected HTML content type: {html_type}"
    assert b"<!DOCTYPE html>" in html_body, "HTML search did not return a page"
    assert json_status == 200, f"JSON search returned {json_status}"
    assert json_type == "application/json", f"unexpected JSON content type: {json_type}"
    assert payload["query"] == "searxng smoke test", "JSON search query mismatch"

    print(json.dumps({"html": html_status, "json": json_status}, sort_keys=True))


if __name__ == "__main__":
    main()
