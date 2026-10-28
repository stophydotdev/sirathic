import { countOf, countUpBy } from "@sirathic/core/cache";
import type { LanguageModelUsage, ProviderMetadata } from "ai";
import { z } from "zod";
import { reasonOf, StatusError } from "../http";
import { noorModel } from "./noor";

const HOUR = 60 * 60;
const NOOR_WINDOWS = [
  { seconds: 5 * HOUR, limit: 1_500_000 },
  { seconds: 7 * 24 * HOUR, limit: 4_600_000 },
] as const;
const PRICIER_ABOVE = 100_000;

const hourWrites = z.object({
  anthropic: z.object({
    usage: z.object({ cache_creation: z.object({ ephemeral_1h_input_tokens: z.number() }) }),
  }),
});

export const countedTokens = (
  usage: LanguageModelUsage,
  metadata: ProviderMetadata | undefined,
) => {
  const { noCacheTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0 } = usage.inputTokenDetails;
  const hour =
    hourWrites.safeParse(metadata).data?.anthropic.usage.cache_creation.ephemeral_1h_input_tokens ??
    0;
  const counted =
    noCacheTokens +
    (cacheWriteTokens - hour) * 1.25 +
    hour * 2 +
    cacheReadTokens * 0.1 +
    (usage.outputTokens ?? 0) * 5;
  return Math.ceil((usage.inputTokens ?? 0) > PRICIER_ABOVE ? counted * 5 : counted);
};

const keyOf = (seconds: number, by: string) => `noor-usage:${seconds}:${by}`;

export const noorUsage = (by: string) =>
  Promise.all(
    NOOR_WINDOWS.map(async ({ seconds, limit }) => {
      const { total, leftMs } = await countOf(keyOf(seconds, by));
      return {
        seconds,
        usedPercent: Math.min(100, (100 * total) / limit),
        resetAt: leftMs > 0 ? Date.now() + leftMs : null,
      };
    }),
  );

const resetText = (seconds: number, resetAt: number, timeZone: string) =>
  seconds === NOOR_WINDOWS[0].seconds
    ? `You've used Noor's limit for now. It resets at ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone }).format(resetAt)}.`
    : `You've used this week's Noor limit. It resets ${new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone }).format(resetAt)}.`;

const GPT_WAY_OUT = " Sign in with ChatGPT to keep asking with GPT.";

export async function checkNoorUsage({
  by,
  modelName,
  timeZone = "UTC",
  offerGpt,
}: {
  by: string;
  modelName: string;
  timeZone?: string;
  offerGpt: boolean;
}) {
  if (!noorModel(modelName)) return;
  const windows = await noorUsage(by).catch((err: Error) => {
    console.error(`noor usage not read: ${reasonOf(err)}`);
    return [];
  });
  const full = windows.findLast(({ usedPercent }) => usedPercent >= 100);
  if (full?.resetAt) {
    const reset = resetText(full.seconds, full.resetAt, timeZone);
    throw new StatusError(429, offerGpt ? reset + GPT_WAY_OUT : reset);
  }
}

export const spendNoor = (by: string, modelName: string) =>
  noorModel(modelName)
    ? (counted: number) =>
        void Promise.all(
          NOOR_WINDOWS.map(({ seconds }) => countUpBy(keyOf(seconds, by), counted, seconds)),
        ).catch((err: Error) => {
          console.error(`noor usage not counted: ${reasonOf(err)}`);
        })
    : undefined;
