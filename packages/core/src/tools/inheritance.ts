import { z } from "zod";
import {
  commonDenominator,
  fraction,
  over,
  toNumber,
  toText,
  total,
} from "../inheritance/fraction";
import { DIFFERENCES, HEIR_LABELS, heirKeys, heirsSchema } from "../inheritance/rules";
import { solve } from "../inheritance/solver";
import { round } from "../zoned";

const BEQUEST_CAP = 1 / 3;

export const inheritanceInput = z
  .object({
    estate: z.number().positive().describe("Total value of everything the deceased left"),
    debts: z
      .number()
      .min(0)
      .default(0)
      .describe("Debts and funeral costs, paid before anything else"),
    bequest: z
      .number()
      .min(0)
      .default(0)
      .describe(
        "Bequest (wasiyyah) to a non-heir or charity. Capped at one third of the estate after debts.",
      ),
    currency: z
      .string()
      .max(10)
      .optional()
      .describe("Currency of the amounts, for labelling the result"),
    heirs: heirsSchema.describe(
      "The surviving relatives and how many of each. Leave out those who are absent.",
    ),
  })
  .describe(
    "Sunni fara'id (Islamic inheritance) shares following the majority position. Always tell the user to confirm a real estate with a qualified scholar.",
  )
  .superRefine(({ heirs }, context) => {
    const counted = heirKeys.reduce((sum, heir) => sum + (heirs[heir] ?? 0), 0);
    if (counted === 0) {
      context.addIssue({
        code: "custom",
        path: ["heirs"],
        message: "At least one surviving heir is required",
      });
    }
    if ((heirs.husband ?? 0) > 0 && (heirs.wife ?? 0) > 0) {
      context.addIssue({
        code: "custom",
        path: ["heirs"],
        message: "A husband and a wife cannot both survive the same person",
      });
    }
  });

export const inheritance = (input: z.input<typeof inheritanceInput>) => {
  const { estate, debts, bequest, currency, heirs } = inheritanceInput.parse(input);
  const afterDebts = Math.max(estate - debts, 0);
  const bequestApplied = Math.min(bequest, afterDebts * BEQUEST_CAP);
  const distributable = afterDebts - bequestApplied;
  const solution = solve(heirs);
  const excludedHeirs = new Set(solution.excluded.map(({ heir }) => heir));

  const shares = heirKeys
    .filter((heir) => (heirs[heir] ?? 0) > 0 && !excludedHeirs.has(heir))
    .map((heir) => {
      const parts = solution.parts.filter((entry) => entry.heir === heir);
      return {
        heir,
        parts,
        share: total(parts.map((entry) => entry.fraction)),
      };
    });

  const lines = shares.map(({ heir, parts, share }) => {
    const count = heirs[heir] ?? 0;
    const each = over(share, fraction(count));
    return {
      heir,
      label: HEIR_LABELS[heir],
      count,
      fraction: toText(share),
      percentage: round(toNumber(share) * 100, 2),
      amount: round(distributable * toNumber(share), 2),
      each:
        count > 1
          ? {
              fraction: toText(each),
              amount: round(distributable * toNumber(each), 2),
            }
          : null,
      basis: [...new Set(parts.map((entry) => entry.kind))],
      explanation:
        parts.length === 0
          ? ["Nothing is left after the fixed shares and the nearer heirs."]
          : parts.map((entry) => entry.reason),
      sources: [...new Set(parts.map((entry) => entry.source))],
    };
  });

  const bequestCapped = bequest > bequestApplied;
  const steps = [
    `Estate ${estate} minus debts and funeral costs ${debts} leaves ${round(afterDebts, 2)}.`,
    ...(bequest > 0
      ? [
          bequestCapped
            ? `The bequest of ${bequest} is above one third, so only ${round(bequestApplied, 2)} is valid without the heirs' consent.`
            : `The bequest of ${bequest} is within one third and is paid first.`,
        ]
      : []),
    `${round(distributable, 2)} is divided among the heirs.`,
    ...solution.steps,
  ];

  return {
    estate: {
      total: estate,
      debts,
      afterDebts: round(afterDebts, 2),
      bequestRequested: bequest,
      bequestApplied: round(bequestApplied, 2),
      bequestCapped,
      distributable: round(distributable, 2),
      currency: currency ?? null,
    },
    heirs: lines,
    excluded: solution.excluded.map(({ heir, reason }) => ({
      heir,
      label: HEIR_LABELS[heir],
      count: heirs[heir] ?? 0,
      reason,
    })),
    unresolved:
      solution.unresolved.n === 0n
        ? null
        : {
            fraction: toText(solution.unresolved),
            percentage: round(toNumber(solution.unresolved) * 100, 2),
            amount: round(distributable * toNumber(solution.unresolved), 2),
            note: "No heir in this tool can receive this part. It goes to other relatives (dhawu al-arham) or the public treasury, depending on the school.",
          },
    commonDenominator: commonDenominator(shares.map(({ share }) => share)),
    steps,
    rulesApplied: solution.rules,
    schoolDifferences: solution.rules.map((rule) => DIFFERENCES[rule]),
    basis:
      "Sunni fara'id following the majority (jumhur) position: fixed shares (fard), residuary heirs ('asaba), exclusion (hajb), proportional reduction ('awl), return of the surplus (radd, not to spouses), and the 'Umariyyah cases. Order of payment: funeral and debts, then a bequest of up to one third, then the inheritance (Qur'an 4:11-12).",
    caveats: [
      "Confirm any real estate with a qualified scholar or the local Islamic court before acting on it. This tool covers the common heirs only.",
      "Not covered: great-grandparents, cousins and their sons, nieces, half-uncles' sons, other distant relatives, a missing person, a pregnancy, unequal religions, killing the deceased, and estates with several deaths.",
      "A bequest to an heir is not valid without the consent of the other heirs. A bequest above one third also needs their consent after the death.",
      "Amounts are rounded to the cent, so they may differ from the total by a cent.",
    ],
  };
};
