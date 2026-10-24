import {
  compare,
  type Fraction,
  fraction,
  isPositive,
  minus,
  ONE,
  over,
  smaller,
  times,
  toText,
  total,
  ZERO,
} from "./fraction";
import {
  ASABA_CLASSES,
  type Context,
  exclusionReason,
  FARD_GROUPS,
  type FardGroup,
  factsOf,
  HEIR_LABELS,
  type HeirKey,
  type Heirs,
  heirKeys,
  isUmariyyah,
  type RuleId,
  SOURCES,
} from "./rules";

type PartKind = "fard" | "asaba" | "muqasama" | "radd";

type Part = {
  heir: HeirKey;
  kind: PartKind;
  fraction: Fraction;
  reason: string;
  source: string;
};

export type Solution = {
  parts: Part[];
  excluded: { heir: HeirKey; reason: string }[];
  unresolved: Fraction;
  steps: string[];
  rules: RuleId[];
};

const SPOUSES = new Set<HeirKey>(["husband", "wife"]);
const SIBLINGS_WITH_GRANDFATHER: readonly HeirKey[] = [
  "full_brother",
  "full_sister",
  "paternal_brother",
  "paternal_sister",
];
const MATERNAL_SIBLINGS: readonly HeirKey[] = ["maternal_brother", "maternal_sister"];
const AKDARIYYAH_HEIRS = new Set<HeirKey>([
  "husband",
  "mother",
  "paternal_grandfather",
  "full_sister",
  "paternal_sister",
]);

const part = (
  heir: HeirKey,
  kind: PartKind,
  share: Fraction,
  reason: string,
  source: string,
): Part => ({ heir, kind, fraction: share, reason, source });

const split = (
  context: Context,
  share: Fraction,
  weights: readonly (readonly [HeirKey, number])[],
  kind: PartKind,
  reason: string,
  source: string,
) => {
  const live = weights.filter(([heir]) => context.live(heir));
  const sum = live.reduce((acc, [heir, weight]) => acc + weight * context.n(heir), 0);
  if (!isPositive(share) || sum === 0) return [];
  return live.map(([heir, weight]) =>
    part(heir, kind, times(share, fraction(weight * context.n(heir), sum)), reason, source),
  );
};

const fardParts = (context: Context, groups: readonly FardGroup[]) => {
  const parts: Part[] = [];
  for (const group of groups) {
    const taken = total(parts.map((entry) => entry.fraction));
    const members = group.members.filter(context.live);
    const rule = group.rules.find((candidate) => candidate.when(context, taken));
    if (members.length > 0 && rule?.share) {
      parts.push(
        ...split(
          context,
          rule.share(context, taken),
          members.map((heir) => [heir, 1] as const),
          "fard",
          rule.why,
          group.source,
        ),
      );
    }
  }
  return parts;
};

const grandfatherWithSiblings = (context: Context, others: Fraction) => {
  const remainder = minus(ONE, others);
  const n = context.n;
  const units =
    2 * (n("full_brother") + n("paternal_brother")) + n("full_sister") + n("paternal_sister");
  const options = [
    {
      kind: "muqasama" as const,
      value: times(remainder, fraction(2, 2 + units)),
      reason: "shares with the siblings as if he were a brother, which is best for him here",
    },
    {
      kind: "muqasama" as const,
      value: times(remainder, fraction(1, 3)),
      reason: "takes a third of what remains, which is best for him here",
    },
    {
      kind: "fard" as const,
      value: fraction(1, 6),
      reason: "takes a sixth of the estate, which is best for him here",
    },
  ];
  const best = options.reduce((chosen, option) =>
    compare(option.value, chosen.value) > 0 ? option : chosen,
  );
  const portion = isPositive(minus(remainder, best.value)) ? minus(remainder, best.value) : ZERO;
  const hasFull = n("full_brother") + n("full_sister") > 0;
  const uncapped = n("full_brother") > 0 || context.femaleDescendant;
  const sisterFard = n("full_sister") === 1 ? fraction(1, 2) : fraction(2, 3);
  const fullShare = hasFull ? (uncapped ? portion : smaller(portion, sisterFard)) : ZERO;
  const reason = "Takes what remains with the grandfather, who shares as a brother would";
  return [
    ...split(
      context,
      best.value,
      [["paternal_grandfather", 1]],
      best.kind,
      `Grandfather ${best.reason}`,
      SOURCES.grandfather,
    ),
    ...split(
      context,
      fullShare,
      [
        ["full_brother", 2],
        ["full_sister", 1],
      ],
      "muqasama",
      reason,
      SOURCES.siblings,
    ),
    ...split(
      context,
      minus(portion, fullShare),
      [
        ["paternal_brother", 2],
        ["paternal_sister", 1],
      ],
      "muqasama",
      reason,
      SOURCES.siblings,
    ),
  ];
};

const asabaParts = (context: Context, remainder: Fraction, skip: readonly HeirKey[]) => {
  const chosen = ASABA_CLASSES.filter(
    (candidate) => ![...candidate.males, ...candidate.females].some((heir) => skip.includes(heir)),
  ).find(
    (candidate) =>
      candidate.males.some(context.live) ||
      (candidate.femalesAlone && context.femaleDescendant && candidate.females.some(context.live)),
  );
  if (chosen === undefined) return [];
  return split(
    context,
    remainder,
    [
      ...chosen.males.map((heir) => [heir, 2] as const),
      ...chosen.females.map((heir) => [heir, 1] as const),
    ],
    "asaba",
    "Takes the residue as the nearest male relative; a male receives twice a female's share",
    SOURCES.residue,
  );
};

const raddParts = (parts: readonly Part[], surplus: Fraction) => {
  const eligible = parts.filter((entry) => !SPOUSES.has(entry.heir));
  const base = total(eligible.map((entry) => entry.fraction));
  if (!isPositive(base)) return [];
  return eligible.map((entry) =>
    part(
      entry.heir,
      "radd",
      times(surplus, over(entry.fraction, base)),
      "Receives a share of the surplus in proportion to the fixed share (radd)",
      SOURCES.residue,
    ),
  );
};

const akdariyyahParts = (context: Context) => {
  const sister = context.live("full_sister") ? "full_sister" : "paternal_sister";
  const reason =
    "Al-Akdariyyah: the sister is given a half, then she and the grandfather pool their shares and split them two to one";
  return [
    part(
      "husband",
      "fard",
      fraction(1, 3),
      "A half, reduced by 'awl to a third (3 of 9)",
      SOURCES.spouses,
    ),
    part("mother", "fard", fraction(2, 9), "A third, reduced by 'awl to 2 of 9", SOURCES.children),
    part("paternal_grandfather", "muqasama", fraction(8, 27), reason, SOURCES.grandfather),
    part(sister, "muqasama", fraction(4, 27), reason, SOURCES.siblings),
  ];
};

const describe = (entry: Part) =>
  `${HEIR_LABELS[entry.heir]} ${toText(entry.fraction)}: ${entry.reason}.`;

export const solve = (heirs: Heirs): Solution => {
  const facts = factsOf(heirs);
  const exclusions = new Map(
    heirKeys.flatMap((heir) => {
      const reason = facts.n(heir) > 0 ? exclusionReason(heir, facts) : undefined;
      return reason === undefined ? [] : [[heir, reason] as const];
    }),
  );
  const context: Context = {
    ...facts,
    live: (heir) => facts.n(heir) > 0 && !exclusions.has(heir),
  };
  const excluded = [...exclusions].map(([heir, reason]) => ({ heir, reason }));
  const rules = new Set<RuleId>();
  const steps = excluded.map(({ heir, reason }) => `${HEIR_LABELS[heir]}: ${reason}`);

  const siblingsPresent = SIBLINGS_WITH_GRANDFATHER.filter(context.live);
  const akdariyyah =
    heirKeys.every((heir) => AKDARIYYAH_HEIRS.has(heir) || facts.n(heir) === 0) &&
    facts.n("husband") === 1 &&
    facts.n("mother") === 1 &&
    facts.n("paternal_grandfather") === 1 &&
    facts.n("full_sister") + facts.n("paternal_sister") === 1;

  if (akdariyyah) {
    rules.add("akdariyyah");
    rules.add("grandfather_with_siblings");
    const parts = akdariyyahParts(context);
    return {
      parts,
      excluded,
      unresolved: ZERO,
      steps: [...steps, ...parts.map(describe)],
      rules: [...rules],
    };
  }

  const shared = context.live("paternal_grandfather") && siblingsPresent.length > 0;
  const skip: readonly HeirKey[] = shared
    ? ["paternal_grandfather", ...SIBLINGS_WITH_GRANDFATHER]
    : [];
  const fixedParts = fardParts(
    context,
    FARD_GROUPS.filter((group) => !group.members.some((heir) => skip.includes(heir))),
  );
  if (shared) rules.add("grandfather_with_siblings");
  if (facts.n("mother") > 0 && !facts.descendant && facts.siblings >= 2) {
    rules.add("mother_and_siblings");
  }
  if (isUmariyyah(context) && context.live("mother")) rules.add("umariyyah");
  if (facts.n("paternal_grandmother") > 0 && facts.n("father") > 0) {
    rules.add("paternal_grandmother_and_father");
  }
  const withShared = shared
    ? [
        ...fixedParts,
        ...grandfatherWithSiblings(context, total(fixedParts.map((entry) => entry.fraction))),
      ]
    : fixedParts;
  steps.push(...withShared.map(describe));

  const sum = total(withShared.map((entry) => entry.fraction));

  if (compare(sum, ONE) > 0) {
    rules.add("awl");
    steps.push(
      `The shares add up to ${toText(sum)}, more than the whole estate, so each share is divided by ${toText(sum)} ('awl).`,
    );
    return {
      parts: withShared.map((entry) => ({
        ...entry,
        fraction: over(entry.fraction, sum),
      })),
      excluded,
      unresolved: ZERO,
      steps,
      rules: [...rules],
    };
  }

  const remainder = minus(ONE, sum);
  if (!isPositive(remainder)) {
    const maternal = MATERNAL_SIBLINGS.filter(context.live).reduce(
      (heads, heir) => heads + facts.n(heir),
      0,
    );
    if (context.live("full_brother") && maternal >= 2) {
      rules.add("mushtaraka");
      steps.push("Nothing remains for the full brothers after the fixed shares (al-Mushtarakah).");
    }
    return {
      parts: withShared,
      excluded,
      unresolved: ZERO,
      steps,
      rules: [...rules],
    };
  }

  const residue = asabaParts(context, remainder, skip);
  if (residue.length > 0) {
    steps.push(
      `The remaining ${toText(remainder)} goes to ${residue.map((entry) => HEIR_LABELS[entry.heir].toLowerCase()).join(" and ")} as residue.`,
    );
    return {
      parts: [...withShared, ...residue],
      excluded,
      unresolved: ZERO,
      steps,
      rules: [...rules],
    };
  }

  const returned = raddParts(withShared, remainder);
  if (returned.length > 0) {
    rules.add("radd");
    steps.push(
      `${toText(remainder)} of the estate is left over and no residuary heir exists, so it is returned to the fixed-share heirs other than the spouse in proportion to their shares (radd).`,
    );
    return {
      parts: [...withShared, ...returned],
      excluded,
      unresolved: ZERO,
      steps,
      rules: [...rules],
    };
  }

  steps.push(
    `${toText(remainder)} of the estate is left over, and the majority do not return it to a spouse. It goes to other relatives (dhawu al-arham) or the public treasury, which this tool does not compute.`,
  );
  return {
    parts: withShared,
    excluded,
    unresolved: remainder,
    steps,
    rules: [...rules],
  };
};
