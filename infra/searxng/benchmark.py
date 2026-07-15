import argparse
import json
import math
import statistics
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlencode
from urllib.request import urlopen


CASES = (
    ("Quran 2:183 fasting", ("quran.com",)),
    ("Sahih Bukhari actions are by intentions", ("sunnah.com",)),
    ("Hanafi nullifiers of wudu", ("seekersguidance.org", "islamqa.org")),
    ("OpenAI GPT-5", ("openai.com",)),
    ("Railway private networking", ("docs.railway.com",)),
    ("Python asyncio documentation", ("docs.python.org",)),
    ("SearXNG outgoing settings", ("docs.searxng.org",)),
)


def percentile(values: list[float], fraction: float) -> int:
    ordered = sorted(values)
    index = max(0, math.ceil(len(ordered) * fraction) - 1)
    return round(ordered[index])


def run_search(base_url: str, timeout: float, query: str, expected_hosts: tuple[str, ...]) -> dict:
    url = f"{base_url.rstrip('/')}/search?{urlencode({'q': query, 'format': 'json'})}"
    started = time.perf_counter()

    try:
        with urlopen(url, timeout=timeout) as response:
            payload = json.load(response)

        results = payload.get("results", [])
        urls = [str(result.get("url", "")).lower() for result in results[:10]]
        engines = sorted({engine for result in results for engine in result.get("engines", [])})
        unresponsive = [entry[0] for entry in payload.get("unresponsive_engines", []) if entry]
        return {
            "ok": response.status == 200,
            "useful": len(results) >= 5,
            "target_hit": any(host in url for host in expected_hosts for url in urls),
            "latency_ms": (time.perf_counter() - started) * 1_000,
            "result_count": len(results),
            "engines": engines,
            "unresponsive": unresponsive,
            "error": None,
        }
    except Exception as error:
        return {
            "ok": False,
            "useful": False,
            "target_hit": False,
            "latency_ms": (time.perf_counter() - started) * 1_000,
            "result_count": 0,
            "engines": [],
            "unresponsive": [],
            "error": f"{type(error).__name__}: {error}",
        }


def run_level(base_url: str, timeout: float, concurrency: int, requests: int) -> dict:
    tasks = [CASES[index % len(CASES)] for index in range(requests)]
    started = time.perf_counter()

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(run_search, base_url, timeout, *case) for case in tasks]
        results = [future.result() for future in as_completed(futures)]

    latencies = [result["latency_ms"] for result in results]
    engine_responses = Counter(engine for result in results for engine in result["engines"])
    engine_failures = Counter(engine for result in results for engine in result["unresponsive"])
    errors = Counter(result["error"] for result in results if result["error"])
    wall_seconds = time.perf_counter() - started

    return {
        "concurrency": concurrency,
        "requests": requests,
        "wall_ms": round(wall_seconds * 1_000),
        "throughput_rps": round(requests / wall_seconds, 2),
        "http_success_rate": round(sum(result["ok"] for result in results) / requests, 3),
        "useful_result_rate": round(sum(result["useful"] for result in results) / requests, 3),
        "target_hit_rate": round(sum(result["target_hit"] for result in results) / requests, 3),
        "latency_ms": {
            "mean": round(statistics.fmean(latencies)),
            "p50": percentile(latencies, 0.50),
            "p95": percentile(latencies, 0.95),
            "max": round(max(latencies)),
        },
        "mean_results": round(statistics.fmean(result["result_count"] for result in results), 1),
        "engine_response_rate": {
            engine: round(count / requests, 3) for engine, count in sorted(engine_responses.items())
        },
        "engine_failure_count": dict(sorted(engine_failures.items())),
        "request_errors": dict(errors),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark SearXNG latency, engine coverage, and result quality")
    parser.add_argument("--url", default="http://127.0.0.1:8080")
    parser.add_argument("--levels", default="1,5,10,25,50,100")
    parser.add_argument("--requests-per-level", type=int, default=0)
    parser.add_argument("--timeout", type=float, default=20.0)
    args = parser.parse_args()

    levels = [int(value) for value in args.levels.split(",") if int(value) > 0]
    report = {
        "url": args.url,
        "query_count": len(CASES),
        "levels": [
            run_level(
                args.url,
                args.timeout,
                concurrency,
                args.requests_per_level or max(concurrency, len(CASES)),
            )
            for concurrency in levels
        ],
    }
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
