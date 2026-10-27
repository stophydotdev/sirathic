import { env } from "@sirathic/env/server";
import { z } from "zod";

export const JEV = "typesafeai-jev-1-14-0";
const WAIT_MS = 5_000;

type State = string | Readonly<Record<string, string | Readonly<Record<string, string>>>>;

const decided = z.object({ answers: z.record(z.string(), z.object({ noul: z.number() })) });

export const yesChances = async (state: State, questions: Readonly<Record<string, string>>) => {
  const res = await fetch(`${env.NEON_AI_GATEWAY_BASE_URL}/typesafe/v1/systemone`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.NEON_AI_GATEWAY_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: JEV,
      state,
      questions: Object.fromEntries(
        Object.entries(questions).map(([name, instructions]) => [
          name,
          { type: "noul", instructions },
        ]),
      ),
    }),
    signal: AbortSignal.timeout(WAIT_MS),
  });
  if (!res.ok) throw new Error(`Jev answered ${res.status}`);
  const { answers } = decided.parse(await res.json());
  return (name: string) => answers[name]?.noul;
};
