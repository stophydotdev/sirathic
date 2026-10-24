import { afterEach, expect, spyOn, test } from "bun:test";
import { zakatCalculator } from "@sirathic/core/tools/zakatCalculator";

const prices = { goldPricePerGram: 130, silverPricePerGram: 1.8 };

const dueOn = async (input: Parameters<typeof zakatCalculator>[0]) => {
  const result = await zakatCalculator({ ...prices, ...input });
  if (result.status !== "ok") throw new Error("expected prices");
  return result;
};

afterEach(() => {
  spyOn(globalThis, "fetch").mockRestore();
});

test("cash between the silver and gold nisab is due on silver and not on gold", async () => {
  const result = await dueOn({ cash: 10_000 });
  expect(result.byBasis.silver).toMatchObject({
    nisabValue: 1071,
    reached: true,
    zakatDue: 250,
  });
  expect(result.byBasis.gold).toMatchObject({
    nisabValue: 11_050,
    reached: false,
    zakatDue: 0,
  });
  expect(result.zakatDue).toBe(250);
});

test("the chosen nisab basis decides the headline amount", async () => {
  expect((await dueOn({ cash: 10_000, nisabBasis: "gold" })).zakatDue).toBe(0);
  expect((await dueOn({ cash: 20_000, nisabBasis: "gold" })).zakatDue).toBe(500);
});

test("every kind of asset counts, and short-term debts come off", async () => {
  const result = await dueOn({
    cash: 1000,
    goldGrams: 10,
    silverValue: 200,
    investments: 3000,
    businessStock: 2000,
    receivables: 500,
    shortTermDebts: 1000,
  });
  expect(result.assets.total).toBe(8000);
  expect(result.netZakatableWealth).toBe(7000);
  expect(result.zakatDue).toBe(175);
});

test("wealth below the nisab owes nothing", async () => {
  expect((await dueOn({ cash: 1000 })).zakatDue).toBe(0);
});

test("when the price service is down the result says what to ask the user", async () => {
  spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
  const result = await zakatCalculator({ cash: 10_000, currency: "EUR" });
  expect(result).toMatchObject({
    status: "prices_unavailable",
    nisabGrams: { gold: 85, silver: 595 },
  });
});
