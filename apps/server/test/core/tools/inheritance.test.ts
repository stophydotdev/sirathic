import { expect, test } from "bun:test";
import { inheritance } from "@sirathic/core/tools/inheritance";

type Input = Parameters<typeof inheritance>[0];

const sharesOf = (heirs: Input["heirs"]) =>
  Object.fromEntries(
    inheritance({ estate: 1_000_000, heirs }).heirs.map((line) => [line.heir, line.fraction]),
  );

const topics = (heirs: Input["heirs"]) =>
  inheritance({ estate: 1000, heirs }).schoolDifferences.map((entry) => entry.topic);

test("textbook cases give the textbook shares", () => {
  expect(sharesOf({ husband: 1, daughter: 1, father: 1 })).toEqual({
    husband: "1/4",
    daughter: "1/2",
    father: "1/4",
  });
  expect(sharesOf({ wife: 1, son: 1, daughter: 1, mother: 1 })).toEqual({
    wife: "1/8",
    son: "17/36",
    daughter: "17/72",
    mother: "1/6",
  });
  expect(sharesOf({ wife: 2, son: 1 })).toEqual({ wife: "1/8", son: "7/8" });
  expect(sharesOf({ mother: 1, father: 1 })).toEqual({
    mother: "1/3",
    father: "2/3",
  });
});

test("the two 'Umariyyah cases give the mother a third of what remains", () => {
  expect(sharesOf({ husband: 1, mother: 1, father: 1 })).toEqual({
    husband: "1/2",
    mother: "1/6",
    father: "1/3",
  });
  expect(sharesOf({ wife: 1, mother: 1, father: 1 })).toEqual({
    wife: "1/4",
    mother: "1/4",
    father: "1/2",
  });
});

test("'awl reduces every share when the fixed shares exceed the estate", () => {
  expect(sharesOf({ husband: 1, full_sister: 2 })).toEqual({
    husband: "3/7",
    full_sister: "4/7",
  });
  expect(sharesOf({ wife: 1, daughter: 2, father: 1, mother: 1 })).toEqual({
    wife: "1/9",
    daughter: "16/27",
    father: "4/27",
    mother: "4/27",
  });
});

test("radd returns the surplus to the fixed-share heirs but never to a spouse", () => {
  expect(sharesOf({ mother: 1, daughter: 1 })).toEqual({
    mother: "1/4",
    daughter: "3/4",
  });
  expect(sharesOf({ husband: 1, mother: 1 })).toEqual({
    husband: "1/2",
    mother: "1/2",
  });
  const spouseOnly = inheritance({ estate: 1000, heirs: { wife: 1 } });
  expect(spouseOnly.heirs[0]?.fraction).toBe("1/4");
  expect(spouseOnly.unresolved?.fraction).toBe("3/4");
});

test("a son excludes siblings and the heirs he outranks", () => {
  const result = inheritance({
    estate: 1000,
    heirs: { son: 1, full_brother: 2, paternal_sister: 1, maternal_brother: 1 },
  });
  expect(result.heirs.map((line) => line.fraction)).toEqual(["1"]);
  expect(result.excluded.map((line) => line.heir).toSorted()).toEqual([
    "full_brother",
    "maternal_brother",
    "paternal_sister",
  ]);
});

test("a son's daughter takes the sixth that completes two thirds, and two daughters shut her out", () => {
  expect(sharesOf({ daughter: 1, sons_daughter: 1, father: 1, mother: 1 })).toEqual({
    daughter: "1/2",
    sons_daughter: "1/6",
    father: "1/6",
    mother: "1/6",
  });
  expect(
    inheritance({
      estate: 1000,
      heirs: { daughter: 2, sons_daughter: 1, full_brother: 1 },
    }).excluded.map((line) => line.heir),
  ).toEqual(["sons_daughter"]);
});

test("a sister with a daughter takes the residue and shuts out paternal brothers", () => {
  const result = inheritance({
    estate: 1000,
    heirs: { daughter: 1, full_sister: 1, paternal_brother: 1 },
  });
  expect(result.heirs.map((line) => line.fraction)).toEqual(["1/2", "1/2"]);
  expect(result.excluded.map((line) => line.heir)).toEqual(["paternal_brother"]);
});

test("the grandfather takes the best of sharing as a brother or a third", () => {
  expect(sharesOf({ paternal_grandfather: 1, full_brother: 1 })).toEqual({
    paternal_grandfather: "1/2",
    full_brother: "1/2",
  });
  expect(sharesOf({ paternal_grandfather: 1, full_brother: 3 })).toEqual({
    paternal_grandfather: "1/3",
    full_brother: "2/3",
  });
  expect(sharesOf({ paternal_grandfather: 1, full_sister: 1, paternal_brother: 1 })).toEqual({
    paternal_grandfather: "2/5",
    full_sister: "1/2",
    paternal_brother: "1/10",
  });
});

test("the grandfather keeps a sixth when sharing would give him less", () => {
  expect(sharesOf({ daughter: 2, paternal_grandfather: 1, full_brother: 2 })).toEqual({
    daughter: "2/3",
    paternal_grandfather: "1/6",
    full_brother: "1/6",
  });
});

test("al-Akdariyyah pools the grandfather's and sister's shares", () => {
  expect(
    sharesOf({
      husband: 1,
      mother: 1,
      paternal_grandfather: 1,
      full_sister: 1,
    }),
  ).toEqual({
    husband: "1/3",
    mother: "2/9",
    paternal_grandfather: "8/27",
    full_sister: "4/27",
  });
});

test("al-Mushtarakah leaves the full brothers with nothing", () => {
  expect(sharesOf({ husband: 1, mother: 1, maternal_brother: 2, full_brother: 1 })).toEqual({
    husband: "1/2",
    mother: "1/6",
    maternal_brother: "1/3",
    full_brother: "0",
  });
});

test("where schools differ the result says so", () => {
  expect(topics({ mother: 1, daughter: 1 })).toEqual(["Radd (return of the surplus)"]);
  expect(topics({ paternal_grandfather: 1, full_brother: 1 })).toEqual([
    "Grandfather with full or paternal siblings",
  ]);
  expect(topics({ husband: 1, mother: 1, father: 1 })).toEqual([
    "The two 'Umariyyah cases (husband or wife, mother and father)",
  ]);
});

test("debts come first and a bequest is capped at a third of what is left", () => {
  const result = inheritance({
    estate: 100_000,
    debts: 10_000,
    bequest: 50_000,
    heirs: { husband: 1, daughter: 1, father: 1 },
  });
  expect(result.estate).toMatchObject({
    afterDebts: 90_000,
    bequestApplied: 30_000,
    bequestCapped: true,
    distributable: 60_000,
  });
  expect(result.heirs.map((line) => line.amount)).toEqual([15_000, 30_000, 15_000]);
});

test("a husband and a wife together are rejected", () => {
  expect(() => inheritance({ estate: 1000, heirs: { husband: 1, wife: 1 } })).toThrow(
    "cannot both survive",
  );
});
