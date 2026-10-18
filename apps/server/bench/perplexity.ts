import { z } from "zod";
import {
  PERPLEXITY,
  type PerplexityAnswer,
  readPerplexity,
  readQuestions,
} from "./runs";

const PRESET = "low";
const AT_ONCE = 1;
const CITATION = /\[web:(\d+)\]/gu;

const agentResponse = z.object({
  output: z.array(
    z.object({
      results: z
        .array(z.object({ id: z.number(), url: z.string() }))
        .optional(),
      content: z.array(z.object({ text: z.string().optional() })).optional(),
    }),
  ),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    cost: z.object({ total_cost: z.number() }).optional(),
  }),
});

const key = Bun.env.PERPLEXITY_API_KEY;
if (!key) throw new Error("PERPLEXITY_API_KEY is missing");

const ask = async (
  kind: PerplexityAnswer["kind"],
  question: string,
  attempt = 1,
): Promise<PerplexityAnswer> => {
  const started = performance.now();
  const response = await fetch("https://api.perplexity.ai/v1/agent", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ preset: PRESET, input: question }),
  });
  const parsed = agentResponse.safeParse(
    await response.json().catch(() => undefined),
  );
  if (response.ok && parsed.success) {
    const { output, usage } = parsed.data;
    const text = output
      .flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? "")
      .join("");
    const urls = new Map(
      output
        .flatMap((item) => item.results ?? [])
        .map((result) => [result.id, result.url]),
    );
    const cited = new Set(
      [...text.matchAll(CITATION)].map((match) => Number(match[1])),
    );
    return {
      kind,
      preset: PRESET,
      question,
      seconds: Math.round(performance.now() - started) / 1000,
      text,
      sources: [...cited].flatMap((number) => {
        const url = urls.get(number);
        return url ? [{ number, url }] : [];
      }),
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      },
      cost: usage.cost?.total_cost,
    };
  }
  if (attempt === 5) {
    throw new Error(`Perplexity failed on "${question}": ${response.status}`);
  }
  const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
  await Bun.sleep(reset > Date.now() ? reset - Date.now() + 500 : 5_000);
  return ask(kind, question, attempt + 1);
};

const questions = await readQuestions();
const answers = new Map(
  (await readPerplexity()).map((answer) => [answer.question, answer]),
);
const queue = questions.filter(
  ({ question }) => answers.get(question)?.sources === undefined,
);
let saving = Promise.resolve(0);
const save = () => {
  saving = saving.then(() =>
    Bun.write(
      PERPLEXITY,
      `${JSON.stringify(
        questions.flatMap(({ question }) => answers.get(question) ?? []),
        null,
        2,
      )}\n`,
    ),
  );
  return saving;
};

let spent = 0;
const work = async (): Promise<void> => {
  const next = queue.shift();
  if (next === undefined) return;
  const answer = await ask(next.kind, next.question);
  answers.set(next.question, answer);
  spent += answer.cost ?? 0;
  await save();
  console.log(
    `${next.question.slice(0, 50).padEnd(50)} ${answer.seconds}s, ${answer.sources?.length ?? 0} sources`,
  );
  return work();
};

console.log(`asking Perplexity ${queue.length} questions`);
await Promise.all(Array.from({ length: AT_ONCE }, work));
console.log(
  `${answers.size} answers in ${PERPLEXITY}, this run cost $${spent.toFixed(2)}`,
);
