import { env } from "@sirathic/env/server";
import { z } from "zod";

export const CLEF = "clef-flash";
type ClefModel = "clef" | typeof CLEF;
const WAIT_MS = 2_000;

type State = string | number | readonly State[] | { readonly [key: string]: State };

const decided = z.object({
  result: z.object({ answers: z.record(z.string(), z.object({ noul: z.number().min(0).max(1) })) }),
});

export const yesChances = async (
  state: State,
  questions: Readonly<Record<string, string>>,
  model: ClefModel = CLEF,
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
          Object.entries(questions).map(([name, instructions]) => [
            name,
            { type: "noul", instructions },
          ]),
        ),
      }),
      signal: AbortSignal.timeout(WAIT_MS),
    },
  );
  if (!res.ok) throw new Error(`Clef answered ${res.status}`);
  const {
    result: { answers },
  } = decided.parse(await res.json());
  return (name: string) => answers[name]?.noul;
};

const DECISION_MODEL = "clef";
const DECISION_WAIT_MS = 8_000;

export const decisionChances = async (
  state: State,
  questions: Readonly<Record<string, string>>,
) => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/cloudflare/${DECISION_MODEL}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: DECISION_MODEL,
        state,
        questions: Object.fromEntries(
          Object.entries(questions).map(([name, instructions]) => [
            name,
            { type: "noul", instructions },
          ]),
        ),
      }),
      signal: AbortSignal.timeout(DECISION_WAIT_MS),
    },
  );
  if (!res.ok) throw new Error(`Clef answered ${res.status}`);
  const {
    result: { answers },
  } = decided.parse(await res.json());
  return (name: string) => answers[name]?.noul;
};
