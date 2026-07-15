# Sirathic web

Next.js App Router interface for Sirathic's citation-first research flow. Bun
manages dependencies and scripts; the web app remains a separate deployment
from the Hono API.

## Local development

From the repository root:

```bash
bun run infra:up
bun run dev
```

The API listens on `http://localhost:3000` and Next.js listens on
`http://localhost:3001`. Next proxies `/v1/*` to the API, preserving SSE
streaming without exposing a private backend hostname to the browser.

For a deployed environment, set this on the web service:

```dotenv
SIRATHIC_API_URL=http://sirathic-api.internal:3000
```

The value is consumed by the Next server configuration, not by client code.
