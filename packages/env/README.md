# @sirathic/env

Validated server environment via [T3 Env](https://env.t3.gg) + Zod. This is the
single place that touches `process.env`.

| Import | Key vars |
|--------|----------|
| `@sirathic/env/server` | `DATABASE_URL`, AI provider keys/models, search and fetch URLs |

Importing the server environment validates its values at load; missing or invalid
configuration fails fast with a readable error.

## Use

```ts
import { env } from "@sirathic/env/server"

const provider = env.AI_PROVIDER
const model = provider === "openai" ? env.OPENAI_MODEL : env.OPENROUTER_MODEL
```

See `.env.example` at the repo root for the full list.
