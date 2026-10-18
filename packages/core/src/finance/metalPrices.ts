import { z } from "zod";
import { getJson } from "../web/getJson";

const GOLD_API = "https://api.gold-api.com/price";
const EXCHANGE_API = "https://open.er-api.com/v6/latest/USD";
const GRAMS_PER_TROY_OUNCE = 31.1034768;
const TIMEOUT_MS = 6_000;
const FRESH_MS = 10 * 60_000;
const STALE_MS = 24 * 60 * 60_000;

const spotPrice = z.object({
  price: z.number().positive(),
  updatedAt: z.iso.datetime(),
});

const exchangeRates = z.object({
  result: z.literal("success"),
  time_last_update_utc: z.string(),
  rates: z.record(z.string(), z.number().positive()),
});

type Kept<Value> = { value: Value; at: number };

const remembered = <Value>(load: () => Promise<Value>) => {
  let kept: Kept<Value> | undefined;
  return async () => {
    if (kept !== undefined && Date.now() - kept.at < FRESH_MS) {
      return { value: kept.value, stale: false };
    }
    try {
      const value = await load();
      kept = { value, at: Date.now() };
      return { value, stale: false };
    } catch (error) {
      if (kept !== undefined && Date.now() - kept.at < STALE_MS) {
        return { value: kept.value, stale: true };
      }
      throw error;
    }
  };
};

const perGram = async (symbol: "XAU" | "XAG") => {
  const { price, updatedAt } = await getJson(
    `${GOLD_API}/${symbol}`,
    spotPrice,
    { timeoutMs: TIMEOUT_MS },
  );
  return {
    usdPerOunce: price,
    usdPerGram: price / GRAMS_PER_TROY_OUNCE,
    updatedAt,
  };
};

const loadMetals = async () => {
  const [gold, silver] = await Promise.all([perGram("XAU"), perGram("XAG")]);
  return { gold, silver };
};

const loadRates = async () => {
  const { rates, time_last_update_utc } = await getJson(
    EXCHANGE_API,
    exchangeRates,
    { timeoutMs: TIMEOUT_MS },
  );
  return { rates, updatedAt: time_last_update_utc };
};

export const metalPrices = remembered(loadMetals);

export const usdRates = remembered(loadRates);

export const PRICE_SOURCE = "api.gold-api.com spot price (USD per troy ounce)";
export const RATE_SOURCE = "open.er-api.com daily exchange rates";
