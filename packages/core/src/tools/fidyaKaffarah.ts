import { z } from "zod";
import { UNITS } from "./islamicUnits";
import { round } from "../zoned";

const kinds = ["fidya", "oath_kaffarah", "ramadan_kaffarah"] as const;

type Kind = (typeof kinds)[number];

type Option = {
  type: "feed" | "clothe" | "free_slave" | "fast";
  description: string;
  people?: number;
  days?: number;
};

type Expiation = {
  title: string;
  appliesTo: string;
  optionsOrder: string;
  options: (count: number) => Option[];
  differences: string[];
  sources: string[];
};

const FOOD_PER_PERSON = {
  majority: `One mudd (about ${UNITS.mudd.grams / 1000} kg) of the local staple food per person (Maliki, Shafi'i, Hanbali).`,
  hanafi:
    "Half a sa' of wheat (about 1.63 kg), or one sa' of dates or barley, per person, or two full meals. The Hanafi school allows paying the cash value.",
};

const EXPIATIONS = {
  fidya: {
    title: "Fidya: feeding the poor for missed fasts",
    appliesTo:
      "Someone who can never fast: the elderly who are too weak, or a person with a long-term illness with no hope of recovery. Illness or travel that will pass is made up later (qada), not paid as fidya.",
    optionsOrder: "Feed one poor person for each missed day.",
    options: (count) => [
      {
        type: "feed",
        description: "Feed one poor person for each missed day of fasting.",
        people: count,
      },
    ],
    differences: [
      "Pregnant and nursing women normally make up the fasts later. Scholars differ on whether fidya is also due: Hanafis say no, Shafi'is and Hanbalis say yes if they feared only for the child.",
      "Amount and form: the majority give food, the Hanafi school also accepts the cash value.",
    ],
    sources: ["Qur'an 2:184"],
  },
  oath_kaffarah: {
    title: "Kaffarah for a broken oath",
    appliesTo: "Someone who swore an oath by Allah on a matter in the future and then broke it.",
    optionsOrder:
      "Choose any one of feeding, clothing or freeing a slave. Fast three days only if none of the three is possible.",
    options: (count) => [
      {
        type: "feed",
        description: "Feed ten poor people from the average food of the household.",
        people: 10 * count,
      },
      {
        type: "clothe",
        description: "Clothe ten poor people.",
        people: 10 * count,
      },
      {
        type: "free_slave",
        description: "Free a slave. This is not available today.",
      },
      {
        type: "fast",
        description: "Fast three days, only if unable to do any of the three above.",
        days: 3 * count,
      },
    ],
    differences: [
      "Whether the three fasting days must be consecutive: Hanafis and Hanbalis (the preferred view) require it, Shafi'is and Malikis do not require it but prefer it.",
      "Hanafis require the expiation after the oath is broken. The majority allow it before the oath is broken as well.",
    ],
    sources: ["Qur'an 5:89"],
  },
  ramadan_kaffarah: {
    title: "Kaffarah for deliberately breaking a Ramadan fast",
    appliesTo:
      "Breaking a Ramadan fast on purpose in the daytime without a valid excuse. All schools apply it to sexual intercourse. Hanafis and Malikis also apply it to deliberate eating or drinking. Shafi'is and Hanbalis do not: for those the day is made up and the person repents.",
    optionsOrder:
      "In order (the majority view): free a slave, and if not possible fast 60 days in a row, and if that is not possible feed 60 poor people.",
    options: (count) => [
      {
        type: "free_slave",
        description: "Free a slave. This is not available today.",
      },
      {
        type: "fast",
        description: "Fast 60 days in a row. A break without a valid excuse restarts the count.",
        days: 60 * count,
      },
      {
        type: "feed",
        description: "If unable to fast, feed 60 poor people.",
        people: 60 * count,
      },
    ],
    differences: [
      "The Maliki school lets the person choose among the three, not in order.",
      "The day that was broken must also be made up, in every school.",
      "If several days were broken, schools differ on whether one kaffarah covers them or each day needs its own. The Hanafis say one is enough if all were in the same Ramadan and none was paid yet. Set count to the number your scholar gives.",
      "Whether the wife also owes a kaffarah when she took part differs between schools.",
    ],
    sources: [
      "Hadith of Abu Hurayrah (Bukhari, Muslim): the man who broke his fast with his wife in Ramadan",
    ],
  },
} satisfies Record<Kind, Expiation>;

export const fidyaKaffarahInput = z.object({
  kind: z
    .enum(kinds)
    .describe(
      "fidya (missed fasts, permanently unable), oath_kaffarah (broken oath) or ramadan_kaffarah (deliberately broken Ramadan fast)",
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(1)
    .describe(
      "For fidya, the number of missed days. For the kaffarahs, the number of expiations owed.",
    ),
  mealCost: z
    .number()
    .positive()
    .optional()
    .describe("Cost of one full meal for one person, to estimate money"),
  currency: z
    .string()
    .max(10)
    .optional()
    .describe("Currency of mealCost, for labelling the result"),
});

export const fidyaKaffarah = (input: z.input<typeof fidyaKaffarahInput>) => {
  const { kind, count, mealCost, currency } = fidyaKaffarahInput.parse(input);
  const expiation = EXPIATIONS[kind];
  const options = expiation.options(count);
  const peopleToFeed = options.find((option) => option.type === "feed")?.people;
  return {
    kind,
    count,
    title: expiation.title,
    appliesTo: expiation.appliesTo,
    optionsOrder: expiation.optionsOrder,
    options,
    foodPerPerson: FOOD_PER_PERSON,
    estimatedCost:
      mealCost === undefined || peopleToFeed === undefined
        ? null
        : {
            currency: currency ?? null,
            mealCost,
            peopleToFeed,
            oneMealEach: round(peopleToFeed * mealCost, 2),
            twoMealsEach: round(peopleToFeed * mealCost * 2, 2),
            note: "One meal each is the common modern practice. Two meals each follows the Hanafi rule of feeding lunch and dinner.",
          },
    schoolDifferences: expiation.differences,
    sources: expiation.sources,
    caveats: [
      "Only the poor and needy may receive the food or money.",
      "These are general rulings. Confirm the exact amount and form with a scholar, especially for a kaffarah.",
    ],
  };
};
