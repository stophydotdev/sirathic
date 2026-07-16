FROM ghcr.io/firecrawl/firecrawl@sha256:fd420a09ca5eca6ef5ec897c09f38d825879bfc70f8a86323f2c5ecec6b6d0d3

ENV HOST=0.0.0.0 \
    PORT=3002

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=8 \
  CMD curl -fsS http://127.0.0.1:3002/v0/health/readiness >/dev/null || exit 1

CMD ["node", "dist/src/harness.js", "--start-docker"]
