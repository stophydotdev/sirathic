import { z } from "zod";
import { type Fraction, fraction, minus, ONE, times } from "./fraction";

const count = (max: number, description: string) =>
  z.number().int().min(0).max(max).optional().describe(description);

export const heirsSchema = z.object({
  husband: count(1, "Surviving husband: 0 or 1"),
  wife: count(4, "Number of surviving wives: 0 to 4"),
  son: count(30, "Sons of the deceased"),
  daughter: count(30, "Daughters of the deceased"),
  sons_son: count(30, "Sons of a son of the deceased (grandsons)"),
  sons_daughter: count(30, "Daughters of a son of the deceased (granddaughters)"),
  father: count(1, "Father: 0 or 1"),
  mother: count(1, "Mother: 0 or 1"),
  paternal_grandfather: count(1, "Father's father: 0 or 1"),
  paternal_grandmother: count(1, "Father's mother: 0 or 1"),
  maternal_grandmother: count(1, "Mother's mother: 0 or 1"),
  full_brother: count(30, "Brothers with the same father and mother"),
  full_sister: count(30, "Sisters with the same father and mother"),
  paternal_brother: count(30, "Brothers with the same father only"),
  paternal_sister: count(30, "Sisters with the same father only"),
  maternal_brother: count(30, "Brothers with the same mother only"),
  maternal_sister: count(30, "Sisters with the same mother only"),
  full_nephew: count(30, "Sons of a full brother"),
  paternal_nephew: count(30, "Sons of a paternal (same father only) brother"),
  full_uncle: count(30, "Full brothers of the father"),
  paternal_uncle: count(30, "Brothers of the father with the same grandfather only"),
});

export type Heirs = z.infer<typeof heirsSchema>;
export type HeirKey = keyof Heirs;

export const heirKeys = heirsSchema.keyof().options;

export const HEIR_LABELS = {
  husband: "Husband",
  wife: "Wife",
  son: "Son",
  daughter: "Daughter",
  sons_son: "Son's son",
  sons_daughter: "Son's daughter",
  father: "Father",
  mother: "Mother",
  paternal_grandfather: "Paternal grandfather",
  paternal_grandmother: "Paternal grandmother",
  maternal_grandmother: "Maternal grandmother",
  full_brother: "Full brother",
  full_sister: "Full sister",
  paternal_brother: "Paternal brother",
  paternal_sister: "Paternal sister",
  maternal_brother: "Maternal brother",
  maternal_sister: "Maternal sister",
  full_nephew: "Full brother's son",
  paternal_nephew: "Paternal brother's son",
  full_uncle: "Full paternal uncle",
  paternal_uncle: "Paternal uncle (father's half-brother by father)",
} satisfies Record<HeirKey, string>;

export type Facts = {
  n: (heir: HeirKey) => number;
  maleDescendant: boolean;
  femaleDescendant: boolean;
  descendant: boolean;
  siblings: number;
};

export const factsOf = (heirs: Heirs): Facts => {
  const n = (heir: HeirKey) => heirs[heir] ?? 0;
  const maleDescendant = n("son") + n("sons_son") > 0;
  const femaleDescendant = n("daughter") + n("sons_daughter") > 0;
  return {
    n,
    maleDescendant,
    femaleDescendant,
    descendant: maleDescendant || femaleDescendant,
    siblings:
      n("full_brother") +
      n("full_sister") +
      n("paternal_brother") +
      n("paternal_sister") +
      n("maternal_brother") +
      n("maternal_sister"),
  };
};

export type Context = Facts & { live: (heir: HeirKey) => boolean };

type Blocker = {
  by: HeirKey;
  when?: (facts: Facts) => boolean;
  note?: string;
};

const blockedBy = (...heirs: HeirKey[]): Blocker[] => heirs.map((by) => ({ by }));

const withDaughters = (by: HeirKey): Blocker => ({
  by,
  when: (facts) => facts.femaleDescendant,
  note: "she takes the residue with the daughters, in the brother's place",
});

const sistersWithDaughters = [withDaughters("full_sister"), withDaughters("paternal_sister")];

const fartherAgnates = blockedBy(
  "son",
  "sons_son",
  "father",
  "paternal_grandfather",
  "full_brother",
  "paternal_brother",
);

const BLOCKERS = {
  husband: [],
  wife: [],
  son: [],
  daughter: [],
  father: [],
  mother: [],
  sons_son: blockedBy("son"),
  sons_daughter: [
    ...blockedBy("son"),
    {
      by: "daughter",
      when: (facts) => facts.n("daughter") >= 2 && facts.n("sons_son") === 0,
      note: "two or more daughters already take the two thirds, and no son's son is there to make her a residuary",
    },
  ],
  paternal_grandfather: blockedBy("father"),
  paternal_grandmother: blockedBy("mother", "father"),
  maternal_grandmother: blockedBy("mother"),
  full_brother: blockedBy("son", "sons_son", "father"),
  full_sister: blockedBy("son", "sons_son", "father"),
  paternal_brother: [
    ...blockedBy("son", "sons_son", "father"),
    {
      by: "full_brother",
      when: (facts) => facts.n("paternal_grandfather") === 0,
    },
    withDaughters("full_sister"),
  ],
  paternal_sister: [
    ...blockedBy("son", "sons_son", "father"),
    {
      by: "full_brother",
      when: (facts) => facts.n("paternal_grandfather") === 0,
    },
    withDaughters("full_sister"),
    {
      by: "full_sister",
      when: (facts) =>
        facts.n("full_sister") >= 2 &&
        facts.n("paternal_brother") === 0 &&
        facts.n("paternal_grandfather") === 0,
      note: "two or more full sisters already take the two thirds, and no paternal brother is there to make her a residuary",
    },
  ],
  maternal_brother: blockedBy(
    "son",
    "daughter",
    "sons_son",
    "sons_daughter",
    "father",
    "paternal_grandfather",
  ),
  maternal_sister: blockedBy(
    "son",
    "daughter",
    "sons_son",
    "sons_daughter",
    "father",
    "paternal_grandfather",
  ),
  full_nephew: [...fartherAgnates, ...sistersWithDaughters],
  paternal_nephew: [...fartherAgnates, ...blockedBy("full_nephew"), ...sistersWithDaughters],
  full_uncle: [
    ...fartherAgnates,
    ...blockedBy("full_nephew", "paternal_nephew"),
    ...sistersWithDaughters,
  ],
  paternal_uncle: [
    ...fartherAgnates,
    ...blockedBy("full_nephew", "paternal_nephew", "full_uncle"),
    ...sistersWithDaughters,
  ],
} satisfies Record<HeirKey, Blocker[]>;

export const exclusionReason = (heir: HeirKey, facts: Facts): string | undefined => {
  const blocker = BLOCKERS[heir].find(
    (candidate) => facts.n(candidate.by) > 0 && (candidate.when?.(facts) ?? true),
  );
  if (blocker === undefined) return undefined;
  const base = `Excluded by the ${HEIR_LABELS[blocker.by].toLowerCase()}`;
  return blocker.note === undefined ? `${base}.` : `${base}: ${blocker.note}.`;
};

export const SOURCES = {
  children: "Qur'an 4:11",
  spouses: "Qur'an 4:12",
  siblings: "Qur'an 4:12 and 4:176",
  grandmother:
    "Hadith of al-Mughirah ibn Shu'bah and Muhammad ibn Maslamah (Abu Dawud, Tirmidhi): the Prophet gave the grandmother a sixth",
  sonsDaughter:
    "Judgement of Ibn Mas'ud, confirmed by the Prophet's ruling (Bukhari): the son's daughter takes the sixth that completes two thirds",
  residue:
    "Hadith of Ibn 'Abbas (Bukhari, Muslim): give the fixed shares to their people, and what remains goes to the nearest male relative",
  grandfather: "Consensus that the grandfather takes the father's place when there is no father",
} as const;

export const isUmariyyah = (context: Context) =>
  !context.descendant &&
  context.siblings < 2 &&
  context.n("father") > 0 &&
  context.n("husband") + context.n("wife") > 0;

type FardRule = {
  when: (context: Context, taken: Fraction) => boolean;
  share: ((context: Context, taken: Fraction) => Fraction) | null;
  why: string;
  residueToo?: boolean;
};

export type FardGroup = {
  members: readonly HeirKey[];
  source: string;
  rules: readonly FardRule[];
};

const fixed = (n: number, d: number) => {
  const value = fraction(n, d);
  return () => value;
};

const always = () => true;

const FATHER_RULES: readonly FardRule[] = [
  {
    when: (context) => context.maleDescendant,
    share: fixed(1, 6),
    why: "a sixth because there is a son or son's son",
  },
  {
    when: (context) => context.femaleDescendant,
    share: fixed(1, 6),
    why: "a sixth because there are only female descendants, plus whatever remains",
    residueToo: true,
  },
  {
    when: always,
    share: null,
    why: "no descendants, so he takes what remains",
  },
];

export const FARD_GROUPS: readonly FardGroup[] = [
  {
    members: ["husband"],
    source: SOURCES.spouses,
    rules: [
      {
        when: (context) => context.descendant,
        share: fixed(1, 4),
        why: "a quarter because the deceased left descendants",
      },
      {
        when: always,
        share: fixed(1, 2),
        why: "a half because there are no descendants",
      },
    ],
  },
  {
    members: ["wife"],
    source: SOURCES.spouses,
    rules: [
      {
        when: (context) => context.descendant,
        share: fixed(1, 8),
        why: "an eighth, shared equally among the wives, because the deceased left descendants",
      },
      {
        when: always,
        share: fixed(1, 4),
        why: "a quarter, shared equally among the wives, because there are no descendants",
      },
    ],
  },
  {
    members: ["mother"],
    source: SOURCES.children,
    rules: [
      {
        when: isUmariyyah,
        share: (_context, taken) => times(minus(ONE, taken), fraction(1, 3)),
        why: "a third of what remains after the spouse ('Umariyyah case)",
      },
      {
        when: (context) => context.descendant || context.siblings >= 2,
        share: fixed(1, 6),
        why: "a sixth because there are descendants or two or more siblings",
      },
      {
        when: always,
        share: fixed(1, 3),
        why: "a third because there are no descendants and fewer than two siblings",
      },
    ],
  },
  {
    members: ["paternal_grandmother", "maternal_grandmother"],
    source: SOURCES.grandmother,
    rules: [
      {
        when: always,
        share: fixed(1, 6),
        why: "a sixth, shared equally if there is more than one grandmother",
      },
    ],
  },
  {
    members: ["maternal_brother", "maternal_sister"],
    source: SOURCES.siblings,
    rules: [
      {
        when: (context) => context.n("maternal_brother") + context.n("maternal_sister") >= 2,
        share: fixed(1, 3),
        why: "a third shared equally (males and females alike) because there are two or more",
      },
      {
        when: always,
        share: fixed(1, 6),
        why: "a sixth because there is only one",
      },
    ],
  },
  {
    members: ["daughter"],
    source: SOURCES.children,
    rules: [
      {
        when: (context) => context.n("son") > 0,
        share: null,
        why: "she takes half the share of each son from the residue",
      },
      {
        when: (context) => context.n("daughter") === 1,
        share: fixed(1, 2),
        why: "a half because she is alone",
      },
      {
        when: always,
        share: fixed(2, 3),
        why: "two thirds shared equally because there are two or more",
      },
    ],
  },
  {
    members: ["sons_daughter"],
    source: SOURCES.sonsDaughter,
    rules: [
      {
        when: (context) => context.live("sons_son"),
        share: null,
        why: "she takes half the share of each son's son from the residue",
      },
      {
        when: (context) => context.n("daughter") === 1,
        share: fixed(1, 6),
        why: "a sixth that completes two thirds with the single daughter",
      },
      {
        when: (context) => context.n("sons_daughter") === 1,
        share: fixed(1, 2),
        why: "a half because she is alone",
      },
      {
        when: always,
        share: fixed(2, 3),
        why: "two thirds shared equally because there are two or more",
      },
    ],
  },
  {
    members: ["father"],
    source: SOURCES.children,
    rules: FATHER_RULES,
  },
  {
    members: ["paternal_grandfather"],
    source: SOURCES.grandfather,
    rules: FATHER_RULES,
  },
  {
    members: ["full_sister"],
    source: SOURCES.siblings,
    rules: [
      {
        when: (context) => context.live("full_brother"),
        share: null,
        why: "she takes half the share of each full brother from the residue",
      },
      {
        when: (context) => context.femaleDescendant,
        share: null,
        why: "with daughters she takes what remains, in the place of a brother",
      },
      {
        when: (context) => context.n("full_sister") === 1,
        share: fixed(1, 2),
        why: "a half because she is alone",
      },
      {
        when: always,
        share: fixed(2, 3),
        why: "two thirds shared equally because there are two or more",
      },
    ],
  },
  {
    members: ["paternal_sister"],
    source: SOURCES.siblings,
    rules: [
      {
        when: (context) => context.live("paternal_brother"),
        share: null,
        why: "she takes half the share of each paternal brother from the residue",
      },
      {
        when: (context) => context.femaleDescendant,
        share: null,
        why: "with daughters she takes what remains, in the place of a brother",
      },
      {
        when: (context) => context.n("full_sister") === 1,
        share: fixed(1, 6),
        why: "a sixth that completes two thirds with the single full sister",
      },
      {
        when: (context) => context.n("paternal_sister") === 1,
        share: fixed(1, 2),
        why: "a half because she is alone",
      },
      {
        when: always,
        share: fixed(2, 3),
        why: "two thirds shared equally because there are two or more",
      },
    ],
  },
];

export type AsabaClass = {
  males: readonly HeirKey[];
  females: readonly HeirKey[];
  femalesAlone: boolean;
};

export const ASABA_CLASSES: readonly AsabaClass[] = [
  { males: ["son"], females: ["daughter"], femalesAlone: false },
  { males: ["sons_son"], females: ["sons_daughter"], femalesAlone: false },
  { males: ["father"], females: [], femalesAlone: false },
  { males: ["paternal_grandfather"], females: [], femalesAlone: false },
  { males: ["full_brother"], females: ["full_sister"], femalesAlone: true },
  {
    males: ["paternal_brother"],
    females: ["paternal_sister"],
    femalesAlone: true,
  },
  { males: ["full_nephew"], females: [], femalesAlone: false },
  { males: ["paternal_nephew"], females: [], femalesAlone: false },
  { males: ["full_uncle"], females: [], femalesAlone: false },
  { males: ["paternal_uncle"], females: [], femalesAlone: false },
];

const RULE_IDS = [
  "awl",
  "radd",
  "umariyyah",
  "akdariyyah",
  "grandfather_with_siblings",
  "mushtaraka",
  "mother_and_siblings",
  "paternal_grandmother_and_father",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export const DIFFERENCES = {
  awl: {
    topic: "'Awl (proportional reduction)",
    text: "When the fixed shares add up to more than the whole estate, every share is reduced in the same proportion. This is the view of the Companions' consensus and the four schools. Ibn 'Abbas dissented and would reduce only the daughters and sisters; that minority view is not applied.",
  },
  radd: {
    topic: "Radd (return of the surplus)",
    text: "The surplus is returned to the fixed-share heirs in proportion to their shares, but not to a husband or wife. This is the Hanafi and Hanbali position, and later Shafi'i and Maliki jurists also give fatwa for it where the public treasury is not properly run. The early Shafi'i and Maliki position sends the surplus to the public treasury (bayt al-mal) instead. 'Uthman gave radd to spouses too; the majority do not.",
  },
  umariyyah: {
    topic: "The two 'Umariyyah cases (husband or wife, mother and father)",
    text: "The mother takes a third of what remains after the spouse, not a third of the whole estate. This was the ruling of 'Umar and Zayd ibn Thabit and is the majority view of the four schools. Ibn 'Abbas gave the mother a third of the whole estate.",
  },
  akdariyyah: {
    topic: "Al-Akdariyyah (husband, mother, grandfather and one sister)",
    text: "Following Zayd ibn Thabit (Maliki, Shafi'i, Hanbali): the sister is first given her half, the shares are reduced by 'awl to nine, and then the grandfather and sister pool their two shares and split them two to one. Hanafis follow Abu Hanifa's view that the grandfather excludes the sister.",
  },
  grandfather_with_siblings: {
    topic: "Grandfather with full or paternal siblings",
    text: "Computed as Zayd ibn Thabit ruled (Maliki, Shafi'i, Hanbali, and Abu Yusuf and Muhammad of the Hanafis): the grandfather takes the best of sharing with the siblings as a brother, a third of what remains, or a sixth of the estate. Abu Hanifa, following Abu Bakr and Ibn 'Abbas, held that the grandfather takes the father's place and excludes all siblings.",
  },
  mushtaraka: {
    topic: "Al-Mushtarakah (full brothers left with nothing)",
    text: "Nothing remains for the full brothers, so they receive nothing here, as the Hanafi and Hanbali schools hold. The Maliki and Shafi'i schools let them share equally in the third of the maternal siblings, following a later ruling of 'Umar. That alternative is not applied.",
  },
  paternal_grandmother_and_father: {
    topic: "Paternal grandmother with the father",
    text: "The father excludes his own mother, as the majority hold. Ibn Mas'ud and some others let her inherit a sixth alongside her son.",
  },
  mother_and_siblings: {
    topic: "Siblings reducing the mother's share",
    text: "Two or more siblings of any kind, even those excluded from inheriting, reduce the mother from a third to a sixth. This is the majority view. Ibn 'Abbas held that three or more are needed.",
  },
} satisfies Record<RuleId, { topic: string; text: string }>;
