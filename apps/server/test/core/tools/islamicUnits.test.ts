import { expect, test } from "bun:test";
import {
  islamicUnits,
  NISAB_GOLD_GRAMS,
  NISAB_SILVER_GRAMS,
} from "@sirathic/core/tools/islamicUnits";

const convert = (
  value: number,
  from: "dirham" | "dinar" | "sa" | "mudd",
  to: "gram" | "kilogram" | "mudd" | "dinar",
) => islamicUnits({ value, from, to }).result;

test("the nisab weights equal 20 dinars of gold and 200 dirhams of silver", () => {
  expect(convert(20, "dinar", "gram")).toBe(NISAB_GOLD_GRAMS);
  expect(convert(200, "dirham", "gram")).toBe(NISAB_SILVER_GRAMS);
});

test("a sa' is four mudd and weighs about 3 kg", () => {
  expect(convert(1, "sa", "mudd")).toBe(4);
  expect(convert(1, "sa", "kilogram")).toBe(3);
});

test("the result states the values it assumed and flags estimates", () => {
  const result = islamicUnits({ value: 1, from: "sa", to: "gram" });
  expect(
    result.assumptions.map((entry) => [entry.unit, entry.gramsPerUnit]),
  ).toEqual([
    ["sa", 3000],
    ["gram", 1],
  ]);
  expect(result.caveats).toHaveLength(2);
});
