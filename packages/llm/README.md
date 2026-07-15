# @sirathic/llm

The shared Vercel AI SDK provider layer for Sirathic's tool-calling research and
answer generation. Set `AI_PROVIDER` to `openai` or `openrouter`; the selected
provider uses only its own key and model.

## Setup

```bash
export AI_PROVIDER="openai"
export OPENAI_API_KEY="..."
export OPENAI_MODEL="gpt-4o-mini"

export OPENROUTER_API_KEY="..."
export OPENROUTER_MODEL="deepseek/deepseek-v4-flash"
```

## Use

```ts
import { chatModel } from "@sirathic/llm"

const configured = chatModel()
const routed = chatModel("deepseek/deepseek-v4-flash", { provider: "openrouter" })
```

There is intentionally no provider or model fallback. Errors from the selected
provider surface to the API.
