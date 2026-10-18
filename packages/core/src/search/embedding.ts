import { EMBEDDING } from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import { z } from "zod";
import { cacheFor } from "../cache";

const TIMEOUT_MS = 10_000;
const MONTH_MS = 30 * 24 * 60 * 60_000;

const embeddingResponse = z.object({
  data: z
    .array(
      z.object({ embedding: z.array(z.number()).length(EMBEDDING.dimensions) }),
    )
    .length(1),
});

const queryCache = cacheFor({
  namespace: "embedding:v1",
  schema: z.array(z.number()).length(EMBEDDING.dimensions),
  freshMs: MONTH_MS,
  keepMs: MONTH_MS,
});

const fetchEmbedding = async (text: string) => {
  if (env.OPENAI_API_KEY === undefined) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING.model, input: [text] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `OpenAI answered HTTP ${response.status}: ${await response.text()}`,
    );
  }
  const [item] = embeddingResponse.parse(await response.json()).data;
  return item.embedding;
};

export const embedQuery = (query: string) => {
  const text = query.trim().replaceAll(/\s+/gu, " ");
  return queryCache(`${EMBEDDING.model}:${text.toLowerCase()}`, () =>
    fetchEmbedding(text),
  );
};
