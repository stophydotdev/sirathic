import { expect, test } from "bun:test";
import { calculator } from "@sirathic/core/tools/calculator";

test("a percent-of phrase and a unit conversion evaluate to their values", () => {
  expect(calculator({ expression: "15% of 2400" })).toMatchObject({
    result: "360",
    value: 360,
    unit: null,
  });
  expect(calculator({ expression: "5 km to miles" })).toMatchObject({
    result: "3.1068559611867 miles",
    unit: "miles",
  });
});

test.each([
  "f(x) = x^2",
  "x = 5",
  "1:1000000000",
  "zeros(100000)",
  "combinations(1e9, 5e8)",
  "evaluate('1+1')",
])("%s is refused before it runs", (expression) => {
  expect(() => calculator({ expression })).toThrow("not allowed");
});
