import { env } from "@sirathic/env/server";
import { z } from "zod";

export const CLEF = "clef-flash";
type ClefModel = "clef" | typeof CLEF;
const WAIT_MS = { [CLEF]: 2_000, clef: 8_000 } as const satisfies Record<ClefModel, number>;
const CHOICE_WAIT_MS = 6_000;

type State = string | number | readonly State[] | { readonly [key: string]: State };

const decided = z.object({
  result: z.object({ answers: z.record(z.string(), z.object({ noul: z.number().min(0).max(1) })) }),
});

export const yesChances = async (
  state: State,
  questions: Readonly<Record<string, string>>,
  model: ClefModel = CLEF,
  images: readonly string[] = [],
) => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/cloudflare/${model}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        state,
        ...(images.length > 0 && { images }),
        questions: Object.fromEntries(
          Object.entries(questions).map(([name, instructions]) => [
            name,
            { type: "noul", instructions },
          ]),
        ),
      }),
      signal: AbortSignal.timeout(WAIT_MS[model]),
    },
  );
  if (!res.ok) throw new Error(`Clef answered ${res.status}`);
  const {
    result: { answers },
  } = decided.parse(await res.json());
  return (name: string) => answers[name]?.noul;
};

const choice = z.object({
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()),
  confidence: z.number().min(0).max(1),
});

const picked = z.object({
  result: z.object({
    answers: z.record(z.string(), choice),
    usage: z.object({ input_tokens: z.number() }),
  }),
});

type Json = z.infer<ReturnType<typeof z.json>>;

export type Question = { instructions: string; criteria: Readonly<Record<string, string>> };

export const pickOptions = async (
  model: string,
  state: Json,
  questions: Readonly<Record<string, Question>>,
) => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/cloudflare/${model}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        state,
        questions: Object.fromEntries(
          Object.entries(questions).map(([name, question]) => [
            name,
            { type: "choice", ...question },
          ]),
        ),
      }),
      signal: AbortSignal.timeout(CHOICE_WAIT_MS),
    },
  );
  if (!res.ok) throw new Error(`Clef answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const {
    result: { answers, usage },
  } = picked.parse(await res.json());
  return { answers, tokens: usage.input_tokens };
};
