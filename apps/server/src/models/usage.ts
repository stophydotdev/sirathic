import { countOf, countUpBy } from "@sirathic/core/cache";
import type { LanguageModelUsage } from "ai";
import { track } from "../chat/events";
import { reasonOf, StatusError } from "../http";
import { noorModel } from "./noor";

const HOUR = 60 * 60;
const NOOR_WINDOWS = [
  { seconds: 5 * HOUR, limit: 1_500_000 },
  { seconds: 7 * 24 * HOUR, limit: 4_600_000 },
] as const;
export const countedTokens = (usage: LanguageModelUsage) => {
  const { noCacheTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0 } = usage.inputTokenDetails;
  return Math.ceil(
    noCacheTokens + cacheWriteTokens + cacheReadTokens * 0.02 + (usage.outputTokens ?? 0) * 4,
  );
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
    track(
      {
        name: "limit.hit",
        props: { window: full.seconds === NOOR_WINDOWS[0].seconds ? "5h" : "week" },
      },
      by,
    );
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
