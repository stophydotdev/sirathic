import { env } from "@sirathic/env/server";
import { z } from "zod";

export const CLEF = "clef-flash";
const WAIT_MS = 2_000;

type State = string | Readonly<Record<string, string | Readonly<Record<string, string>>>>;

const decided = z.object({
  result: z.object({ answers: z.record(z.string(), z.object({ noul: z.number() })) }),
});

export const yesChances = async (state: State, questions: Readonly<Record<string, string>>) => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/cloudflare/${CLEF}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLEF,
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
