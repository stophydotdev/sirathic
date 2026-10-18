import { z } from "zod";

const DEBT_LIMIT_PERCENT = 30;
const CASH_LIMIT_PERCENT = 30;

const screenStatus = z.enum(["pass", "fail", "info", "unknown"]);

export const screenSchema = z.object({
  id: z.enum(["debt", "cash", "receivables"]),
  label: z.string(),
  amount: z.number().nullable(),
  ratioPercent: z.number().nullable(),
  limitPercent: z.number().nullable(),
  status: screenStatus,
});

type Financials = {
  marketCap: number;
  totalDebt: number | null;
  cash: number | null;
  receivables: number | null;
};

const ratioScreen = (
  id: z.infer<typeof screenSchema>["id"],
  label: string,
  amount: number | null,
  marketCap: number,
  limitPercent: number | null,
): z.infer<typeof screenSchema> => {
  if (amount === null) {
    return {
      id,
      label,
      amount,
      ratioPercent: null,
      limitPercent,
      status: "unknown",
    };
  }
  const exactPercent = (amount / marketCap) * 100;
  const status =
    limitPercent === null
      ? "info"
      : exactPercent < limitPercent
        ? "pass"
        : "fail";
  return {
    id,
    label,
    amount,
    ratioPercent: Number(exactPercent.toFixed(2)),
    limitPercent,
    status,
  };
};

export const screenFinancials = ({
  marketCap,
  totalDebt,
  cash,
  receivables,
}: Financials) => [
  ratioScreen(
    "debt",
    "Total debt / market cap",
    totalDebt,
    marketCap,
    DEBT_LIMIT_PERCENT,
  ),
  ratioScreen(
    "cash",
    "Cash and short-term investments / market cap",
    cash,
    marketCap,
    CASH_LIMIT_PERCENT,
  ),
  ratioScreen(
    "receivables",
    "Receivables / market cap",
    receivables,
    marketCap,
    null,
  ),
];

export const verdictFor = (
  screens: ReturnType<typeof screenFinancials>,
  flagged: boolean,
) => {
  if (screens.some(({ status }) => status === "fail")) {
    return {
      verdict: "fail",
      reason: "A financial ratio is at or above its 30% limit.",
    } as const;
  }
  if (flagged) {
    return {
      verdict: "fail",
      reason: "The industry is usually non-permissible.",
    } as const;
  }
  if (screens.some(({ status }) => status === "unknown")) {
    return {
      verdict: "insufficient_data",
      reason: "Yahoo did not return every balance sheet figure.",
    } as const;
  }
  return {
    verdict: "pass_pending_business_review",
    reason:
      "Both financial ratios are under 30%. The business-activity screen is still unchecked.",
  } as const;
};
