import { Tokenizer } from "@huggingface/tokenizers";
import { env } from "@sirathic/env/server";
import { z } from "zod";

const question = z.object({
  options: z.array(z.union([z.string(), z.boolean()])).min(2),
  temperature: z.number(),
  natural_rates: z.array(z.number()),
  shift: z.number(),
});

const config = z.object({
  max_length: z.number().int(),
  questions: z.record(z.string(), question),
});

type Question = z.infer<typeof question>;
type Option = Question["options"][number];
type Decision = Record<string, { answer: Option; probability: number }>;

const tokenizerFile = z.looseObject({});

async function load(dir: string) {
  const { InferenceSession, Tensor } = await import("onnxruntime-node");
  const [tokenizer, tokenizerConfig, settings, session] = await Promise.all([
    Bun.file(`${dir}/tokenizer.json`).json(),
    Bun.file(`${dir}/tokenizer_config.json`).json(),
    Bun.file(`${dir}/config.json`).json(),
    InferenceSession.create(`${dir}/model.onnx`),
  ]);
  return {
    tokenizer: new Tokenizer(
      tokenizerFile.parse(tokenizer),
      tokenizerFile.parse(tokenizerConfig),
    ),
    settings: config.parse(settings),
    session,
    Tensor,
  };
}

let model: ReturnType<typeof load> | undefined;

function probabilities(logits: Float32Array, spec: Question) {
  const scaled = Array.from(logits, (logit) => logit / spec.temperature);
  const top = Math.max(...scaled);
  const weights = scaled.map(
    (logit, i) =>
      Math.exp(logit - top) *
      ((spec.natural_rates[i] ?? 0) * scaled.length) ** spec.shift,
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return spec.options.map((option, i) => ({
    option,
    probability: (weights[i] ?? 0) / total,
  }));
}

const likeliest = (scored: ReturnType<typeof probabilities>) =>
  scored.reduce((best, next) =>
    next.probability > best.probability ? next : best,
  );

const PERSONAL: ReadonlySet<string> = new Set([
  "risk",
  "harm",
  "waswasa",
  "asker",
]);

export const loggable = (decision: Decision) =>
  Object.fromEntries(
    Object.entries(decision).filter(([qid]) => !PERSONAL.has(qid)),
  );

export async function decide(text: string): Promise<Decision | null> {
  if (env.TAMYIZ_DIR === undefined) return null;
  model ??= load(env.TAMYIZ_DIR);
  const { tokenizer, settings, session, Tensor } = await model;
  const { ids } = tokenizer.encode(text);
  const kept =
    ids.length > settings.max_length
      ? [...ids.slice(0, settings.max_length - 1), ...ids.slice(-1)]
      : ids;
  const dims = [1, kept.length];
  const outputs = await session.run({
    input_ids: new Tensor("int64", BigInt64Array.from(kept, BigInt), dims),
    attention_mask: new Tensor(
      "int64",
      new BigInt64Array(kept.length).fill(1n),
      dims,
    ),
  });
  return Object.fromEntries(
    Object.entries(settings.questions).map(([qid, spec]) => {
      const logits = outputs[qid]?.data;
      if (!(logits instanceof Float32Array)) {
        throw new Error(`tamyiz gave no ${qid} logits`);
      }
      const { option, probability } = likeliest(probabilities(logits, spec));
      return [qid, { answer: option, probability }];
    }),
  );
}
