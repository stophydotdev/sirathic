import { expect, test } from "bun:test";
import {
  screenFinancials,
  verdictFor,
} from "../../../../../packages/core/src/finance/halalRatios";

const financials: Parameters<typeof screenFinancials>[0] = {
  marketCap: 1000,
  totalDebt: 100,
  cash: 100,
  receivables: 100,
};

const statuses = (overrides: Partial<typeof financials>) =>
  screenFinancials({ ...financials, ...overrides }).map(({ status }) => status);

test("a ratio passes only when strictly under 30% of market cap", () => {
  expect(statuses({ totalDebt: 299.9 })).toEqual(["pass", "pass", "info"]);
  expect(statuses({ totalDebt: 300 })).toEqual(["fail", "pass", "info"]);
  expect(statuses({ cash: 300 })).toEqual(["pass", "fail", "info"]);
});

test("a missing figure is unknown, never a pass", () => {
  expect(statuses({ totalDebt: null })).toEqual(["unknown", "pass", "info"]);
});

test("passing ratios still leave the business screen pending", () => {
  const screens = screenFinancials(financials);
  expect(verdictFor(screens, false).verdict).toBe(
    "pass_pending_business_review",
  );
  expect(verdictFor(screens, true).verdict).toBe("fail");
  expect(
    verdictFor(screenFinancials({ ...financials, cash: null }), false).verdict,
  ).toBe("insufficient_data");
});
