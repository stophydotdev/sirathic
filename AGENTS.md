# Sirathic

Islamic answering engine. Bun workspaces monorepo:

- `apps/server` — Hono app on Bun. NDJSON chat streaming at `POST /chat` + `POST /reconnect/:id`, tRPC mounted at `/trpc/*`.
- `packages/core` (`@sirathic/core`) — the engine: search agent, researcher tool loop, prompts, session/block streaming protocol, Firecrawl clients. Framework-free.
- `packages/api` (`@sirathic/api`) — tRPC routers and context.
- `packages/env` (`@sirathic/env`) — validated env via `@t3-oss/env-core`, imported as `@sirathic/env/server`.
- `scripts/` — CLIs: `bun run answer|search|fetch|ask`.

Packages export raw TypeScript (no build step). Run the server with `bun run dev` from the repo root so `.env.local` loads. Search/scrape go through self-hosted Firecrawl (`FIRECRAWL_URL`); LLM calls go through OpenRouter via the AI SDK (`ai` v7 — note: no `generateObject`, use `generateText` + `Output.object`; system prompts go in `instructions`).
