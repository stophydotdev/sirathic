import { expect, test } from "bun:test";
import { zakatAlFitr } from "@sirathic/core/tools/zakatAlFitr";

test("a family of four gives four sa' by the majority view and half a sa' of wheat each by the Hanafi view", () => {
  const result = zakatAlFitr({ people: 4 });
  expect(result.majority).toMatchObject({ kgPerPerson: 3, totalKg: 12 });
  expect(result.hanafi).toMatchObject({
    wheatKgPerPerson: 1.633,
    totalWheatKg: 6.532,
  });
  expect(result.majority.estimatedCost).toBeNull();
});

test("a price per kg gives a money estimate and a custom sa' weight is used", () => {
  const result = zakatAlFitr({
    people: 4,
    pricePerKg: 2,
    currency: "USD",
    saWeightKg: 2.5,
  });
  expect(result.majority.estimatedCost).toEqual({
    currency: "USD",
    perPerson: 5,
    total: 20,
  });
  expect(result.hanafi.estimatedCost).toEqual({
    currency: "USD",
    perPerson: 3.27,
    total: 13.06,
  });
});
