import { z } from "zod";
import { NISAB_GOLD_GRAMS, NISAB_SILVER_GRAMS, UNITS } from "./islamicUnits";
import { metalPrices, PRICE_SOURCE, RATE_SOURCE, usdRates } from "../finance/metalPrices";
import { round } from "../zoned";

const RATE = 0.025;

const amount = z.number().min(0).default(0);

export const zakatCalculatorInput = z.object({
  currency: z
    .string()
    .length(3)
    .transform((code) => code.toUpperCase())
    .default("USD")
    .describe("ISO currency code of every money amount, for example USD, GBP, EUR"),
  cash: amount.describe("Cash in hand and bank balances"),
  goldGrams: amount.describe(
    "Grams of pure (24 carat) gold owned. Worn jewellery is counted here only if the user's school requires zakat on it.",
  ),
  goldValue: amount.describe("Value of gold owned when given as money rather than grams"),
  silverGrams: amount.describe("Grams of pure silver owned"),
  silverValue: amount.describe("Value of silver owned when given as money rather than grams"),
  investments: amount.describe(
    "Market value of shares, funds and other investments held for profit",
  ),
  businessStock: amount.describe("Resale value of trade goods and stock"),
  receivables: amount.describe("Money owed to the user that they expect to collect"),
  shortTermDebts: amount.describe("Debts and bills due now or within the year that the user owes"),
  nisabBasis: z
    .enum(["silver", "gold"])
    .default("silver")
    .describe(
      "Which nisab to apply: silver (595 g, lower, more cautious) or gold (85 g). Both are always shown.",
    ),
  goldPricePerGram: z
    .number()
    .positive()
    .optional()
    .describe("Price of 1 g of pure gold in the given currency. Leave out to use the live price."),
  silverPricePerGram: z
    .number()
    .positive()
    .optional()
    .describe(
      "Price of 1 g of pure silver in the given currency. Leave out to use the live price.",
    ),
});

type ZakatInput = z.output<typeof zakatCalculatorInput>;

type MetalPrice = {
  perGram: number;
  source: string;
  updatedAt: string | null;
};

type PriceBook = {
  gold: MetalPrice;
  silver: MetalPrice;
  exchange: { rate: number; source: string; updatedAt: string } | null;
  stale: boolean;
};

const USER_SUPPLIED = "Supplied by the user";

const livePrices = async (currency: string) => {
  const [metals, rates] = await Promise.all([
    metalPrices(),
    currency === "USD" ? undefined : usdRates(),
  ]);
  const rate = rates === undefined ? 1 : rates.value.rates[currency];
  if (rate === undefined) {
    throw new Error(`No exchange rate for ${currency}`);
  }
  return {
    metals: metals.value,
    rate,
    exchange:
      rates === undefined
        ? null
        : {
            rate,
            source: RATE_SOURCE,
            updatedAt: rates.value.updatedAt,
          },
    stale: metals.stale || rates?.stale === true,
  };
};

type Live = Awaited<ReturnType<typeof livePrices>>;

const metalPrice = (
  metal: "gold" | "silver",
  override: number | undefined,
  live: Live | undefined,
): MetalPrice | undefined => {
  if (override !== undefined) {
    return { perGram: override, source: USER_SUPPLIED, updatedAt: null };
  }
  if (live === undefined) return undefined;
  return {
    perGram: live.metals[metal].usdPerGram * live.rate,
    source: PRICE_SOURCE,
    updatedAt: live.metals[metal].updatedAt,
  };
};

const priceBookFor = async (input: ZakatInput) => {
  const { currency, goldPricePerGram, silverPricePerGram } = input;
  const needsLive = goldPricePerGram === undefined || silverPricePerGram === undefined;
  const live = needsLive ? await livePrices(currency).catch(() => undefined) : undefined;
  const gold = metalPrice("gold", goldPricePerGram, live);
  const silver = metalPrice("silver", silverPricePerGram, live);
  if (gold === undefined || silver === undefined) return undefined;
  return {
    gold,
    silver,
    exchange: live?.exchange ?? null,
    stale: live?.stale === true,
  };
};

const calculateZakat = (input: ZakatInput, prices: PriceBook) => {
  const goldValue = input.goldGrams * prices.gold.perGram + input.goldValue;
  const silverValue = input.silverGrams * prices.silver.perGram + input.silverValue;
  const totalAssets =
    input.cash +
    goldValue +
    silverValue +
    input.investments +
    input.businessStock +
    input.receivables;
  const net = Math.max(totalAssets - input.shortTermDebts, 0);
  const bases = {
    gold: {
      grams: NISAB_GOLD_GRAMS,
      value: NISAB_GOLD_GRAMS * prices.gold.perGram,
    },
    silver: {
      grams: NISAB_SILVER_GRAMS,
      value: NISAB_SILVER_GRAMS * prices.silver.perGram,
    },
  };
  const outcome = (basis: keyof typeof bases) => {
    const reached = net >= bases[basis].value;
    return {
      nisabGrams: bases[basis].grams,
      nisabValue: round(bases[basis].value, 2),
      reached,
      zakatDue: reached ? round(net * RATE, 2) : 0,
    };
  };
  const byBasis = { silver: outcome("silver"), gold: outcome("gold") };
  return {
    status: "ok" as const,
    currency: input.currency,
    assets: {
      cash: input.cash,
      gold: round(goldValue, 2),
      silver: round(silverValue, 2),
      investments: input.investments,
      businessStock: input.businessStock,
      receivables: input.receivables,
      total: round(totalAssets, 2),
    },
    deductions: { shortTermDebts: input.shortTermDebts },
    netZakatableWealth: round(net, 2),
    rate: RATE,
    selectedBasis: input.nisabBasis,
    zakatDue: byBasis[input.nisabBasis].zakatDue,
    byBasis,
    prices: {
      currency: input.currency,
      gold: { ...prices.gold, perGram: round(prices.gold.perGram, 4) },
      silver: { ...prices.silver, perGram: round(prices.silver.perGram, 4) },
      exchange: prices.exchange,
      stale: prices.stale,
    },
    basis: `Zakat is 2.5% of net zakatable wealth held for a full lunar year, when that wealth reaches the nisab. Nisab is 20 dinars of gold (${NISAB_GOLD_GRAMS} g, dinar = ${UNITS.dinar.grams} g) or 200 dirhams of silver (${NISAB_SILVER_GRAMS} g, dirham = ${UNITS.dirham.grams} g).`,
    caveats: [
      "Schools and modern bodies differ on which nisab to use. Silver gives a much lower threshold, so more people owe zakat and the poor benefit more. Gold is used by some for cash savings. Both results are shown.",
      "Deducting debts due now is the view of the Hanafi and Hanbali schools and most modern fatwa bodies. The Shafi'i school is often reported as not deducting debts. Confirm with a scholar if it changes the result.",
      "Zakat is due only after the wealth has been held above the nisab for a full lunar year (hawl). The calculator does not know the holding period.",
      "Some Hanafi references in South Asia use 87.48 g of gold and 612.36 g of silver as the nisab.",
      "Schools differ on zakat for jewellery worn by women: Hanafis require it, the majority do not. Agricultural produce, livestock and mining follow separate rules this calculator does not cover.",
      ...(prices.stale
        ? ["The price service was unreachable, so the last known prices were used."]
        : []),
    ],
  };
};

export const zakatCalculator = async (input: z.input<typeof zakatCalculatorInput>) => {
  const parsed = zakatCalculatorInput.parse(input);
  const prices = await priceBookFor(parsed);
  if (prices === undefined) {
    return {
      status: "prices_unavailable" as const,
      currency: parsed.currency,
      message: `Live gold and silver prices${parsed.currency === "USD" ? "" : ` or the ${parsed.currency} exchange rate`} could not be loaded, so the nisab value cannot be computed.`,
      nisabGrams: { gold: NISAB_GOLD_GRAMS, silver: NISAB_SILVER_GRAMS },
      nextStep: `Ask the user for today's price of 1 g of pure gold and 1 g of pure silver in ${parsed.currency}, then call again with goldPricePerGram and silverPricePerGram.`,
    };
  }
  return calculateZakat(parsed, prices);
};
