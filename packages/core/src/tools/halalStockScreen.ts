import YahooFinance from "yahoo-finance2";
import { z } from "zod";
import { cacheFor } from "../cache";
import { screenFinancials, screenSchema, verdictFor } from "../finance/halalRatios";

const SOURCE =
  "Yahoo Finance via yahoo-finance2 (unofficial API: no SLA, not licensed for redistribution, figures can be wrong or stale)";
const LOOKBACK_MS = 550 * 24 * 60 * 60_000;
const BUSINESS_NOTE =
  "The business-activity screen needs a human check: the core business must be permissible and non-permissible income must stay under 5% of revenue. This tool cannot verify either.";
const NOTES = [
  "Market cap is the current spot value. AAOIFI uses a 12-month trailing average, so ratios can differ.",
  "Total debt comes from Yahoo and includes lease obligations. It is not split into interest-bearing and other debt.",
  "Cash and short-term investments is a proxy for interest-bearing deposits and securities. Long-term securities are not counted.",
  "Receivables / market cap is shown for information. AAOIFI Shariah Standard 21, as amended by Standard 59, has no receivables ratio.",
];
const FLAGGED_INDUSTRY =
  /^(Banks\b|Insurance\b|Credit Services|Mortgage Finance|Beverages - (Brewers|Wineries)|Tobacco|Gambling|Resorts & Casinos)/u;

export const halalStockScreenInput = z.object({
  ticker: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9.^=-]{1,15}$/u)
    .transform((ticker) => ticker.toUpperCase())
    .describe('Yahoo Finance ticker such as "AAPL" or "2222.SR"'),
});

const screenResult = z.object({
  ticker: z.string(),
  name: z.string(),
  currency: z.string(),
  balanceSheetDate: z.string(),
  marketCap: z.number(),
  screens: screenSchema.array(),
  businessActivity: z.object({
    status: z.enum(["needs_human_review", "flagged_industry"]),
    sector: z.string().nullable(),
    industry: z.string().nullable(),
    note: z.string(),
  }),
  verdict: z.enum(["pass_pending_business_review", "fail", "insufficient_data"]),
  verdictReason: z.string(),
  notes: z.string().array(),
  source: z.string(),
});

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const screenCache = cacheFor({
  namespace: "halal-screen:v1",
  schema: screenResult,
  freshMs: 30 * 60_000,
  keepMs: 24 * 60 * 60_000,
});

const loadScreen = async (ticker: string) => {
  const [quote, sheets, profile] = await Promise.all([
    yahoo.quote(ticker),
    yahoo.fundamentalsTimeSeries(ticker, {
      period1: new Date(Date.now() - LOOKBACK_MS),
      type: "quarterly",
      module: "balance-sheet",
    }),
    yahoo
      .quoteSummary(ticker, { modules: ["assetProfile"] })
      .then(({ assetProfile }) => assetProfile)
      .catch(() => undefined),
  ]);
  if (quote === undefined) throw new Error(`Unknown ticker: ${ticker}`);
  const { marketCap, currency, financialCurrency } = quote;
  if (marketCap === undefined || currency === undefined) {
    throw new Error(`Yahoo has no market cap for ${ticker}`);
  }
  if (financialCurrency !== undefined && financialCurrency !== currency) {
    throw new Error(
      `${ticker} reports financials in ${financialCurrency} but trades in ${currency}, so the ratios cannot be compared`,
    );
  }
  const latest = sheets
    .flatMap((row) =>
      "TYPE" in row && row.TYPE === "BALANCE_SHEET" && row.totalAssets !== undefined ? [row] : [],
    )
    .toSorted((a, b) => b.date.getTime() - a.date.getTime())[0];
  if (latest === undefined) {
    throw new Error(`Yahoo has no balance sheet for ${ticker}`);
  }
  const screens = screenFinancials({
    marketCap,
    totalDebt: latest.totalDebt ?? null,
    cash: latest.cashCashEquivalentsAndShortTermInvestments ?? null,
    receivables: latest.receivables ?? latest.accountsReceivable ?? null,
  });
  const industry = profile?.industry ?? null;
  const flagged = industry !== null && FLAGGED_INDUSTRY.test(industry);
  const { verdict, reason } = verdictFor(screens, flagged);
  return {
    ticker: quote.symbol,
    name: quote.longName ?? quote.shortName ?? quote.symbol,
    currency,
    balanceSheetDate: latest.date.toISOString().slice(0, 10),
    marketCap,
    screens,
    businessActivity: {
      status: flagged ? "flagged_industry" : "needs_human_review",
      sector: profile?.sector ?? null,
      industry,
      note: BUSINESS_NOTE,
    },
    verdict,
    verdictReason: reason,
    notes: NOTES,
    source: SOURCE,
  } satisfies z.infer<typeof screenResult>;
};

export const halalStockScreen = async (input: z.input<typeof halalStockScreenInput>) => {
  const { ticker } = halalStockScreenInput.parse(input);
  return screenCache(ticker, () => loadScreen(ticker));
};
