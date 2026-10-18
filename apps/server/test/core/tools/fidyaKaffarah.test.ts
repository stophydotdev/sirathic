import { expect, test } from "bun:test";
import { fidyaKaffarah } from "@sirathic/core/tools/fidyaKaffarah";

test("fidya feeds one poor person for each missed day", () => {
  const result = fidyaKaffarah({ kind: "fidya", count: 30, mealCost: 5 });
  expect(result.options).toMatchObject([{ type: "feed", people: 30 }]);
  expect(result.estimatedCost).toMatchObject({
    oneMealEach: 150,
    twoMealsEach: 300,
  });
});

test("an oath is expiated by feeding or clothing ten, freeing a slave, or three fasts", () => {
  const result = fidyaKaffarah({ kind: "oath_kaffarah" });
  expect(
    result.options.map((option) => [option.type, option.people ?? option.days]),
  ).toEqual([
    ["feed", 10],
    ["clothe", 10],
    ["free_slave", undefined],
    ["fast", 3],
  ]);
});

test("a deliberately broken Ramadan fast is 60 fasts, otherwise 60 poor people fed", () => {
  const result = fidyaKaffarah({ kind: "ramadan_kaffarah", mealCost: 4 });
  expect(
    result.options.map((option) => [option.type, option.people ?? option.days]),
  ).toEqual([
    ["free_slave", undefined],
    ["fast", 60],
    ["feed", 60],
  ]);
  expect(result.estimatedCost?.oneMealEach).toBe(240);
});
