import { BGE_M3, EMBEDDING } from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import { z } from "zod";
import { cacheFor } from "../cache";

const TIMEOUT_MS = 10_000;
const MONTH_MS = 30 * 24 * 60 * 60_000;

export type Embedder = typeof EMBEDDING | typeof BGE_M3;

export class EmbedHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number,
    body: string,
  ) {
    super(`Embedding service answered HTTP ${status}: ${body}`);
  }
}

const openAiResponse = z.object({
  data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })),
  usage: z.object({ total_tokens: z.number() }),
});

const workersAiResponse = z.object({
  result: z.object({
    data: z.array(z.array(z.number())),
    meta: z.object({ cost_metric_value_1: z.number() }),
  }),
});

const post = async (url: string, token: string, body: string, timeoutMs: number) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new EmbedHttpError(
      response.status,
      Number(response.headers.get("retry-after") ?? 0) * 1000,
      await response.text(),
    );
  }
  return response.json();
};

export const embedMany = async (
  embedder: Embedder,
  texts: string[],
  options: { dimensions?: number; timeoutMs?: number } = {},
) => {
  const { dimensions = embedder.dimensions, timeoutMs = TIMEOUT_MS } = options;
  const vectors = z.array(z.array(z.number()).length(dimensions)).length(texts.length);
  switch (embedder.kind) {
    case "openai": {
      const { data, usage } = openAiResponse.parse(
        await post(
          "https://api.openai.com/v1/embeddings",
          env.OPENAI_API_KEY,
          JSON.stringify({ model: embedder.model, input: texts, dimensions }),
          timeoutMs,
        ),
      );
      return {
        vectors: vectors.parse(data.toSorted((a, b) => a.index - b.index).map((d) => d.embedding)),
        tokens: usage.total_tokens,
      };
    }
    case "bgeM3": {
      const { result } = workersAiResponse.parse(
        await post(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${embedder.model}`,
          env.CLOUDFLARE_AI_TOKEN,
          JSON.stringify({ text: texts, truncate_inputs: true }),
          timeoutMs,
        ),
      );
      return { vectors: vectors.parse(result.data), tokens: result.meta.cost_metric_value_1 };
    }
  }
};

const queryCache = cacheFor({
  namespace: "embedding:v1",
  schema: z.array(z.number()),
  freshMs: MONTH_MS,
  keepMs: MONTH_MS,
});

export const embedQuery = (embedder: Embedder, query: string) => {
  const text = query.trim().replaceAll(/\s+/gu, " ");
  return queryCache(`${embedder.model}:${text.toLowerCase()}`, async () => {
    const [vector] = (await embedMany(embedder, [text])).vectors;
    if (vector === undefined) throw new Error("No embedding came back");
    return vector;
  });
};
