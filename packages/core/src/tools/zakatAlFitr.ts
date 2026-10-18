import { z } from "zod";
import { UNITS } from "./islamicUnits";
import { round } from "../zoned";

const HANAFI_HALF_SA_WHEAT_KG = 1.633;

export const zakatAlFitrInput = z.object({
  people: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe(
      "Number of people the payer must pay for: themselves and every dependant",
    ),
  pricePerKg: z
    .number()
    .positive()
    .optional()
    .describe(
      "Local price of 1 kg of the staple food (wheat for the Hanafi figure). Gives a money estimate.",
    ),
  currency: z
    .string()
    .max(10)
    .optional()
    .describe("Currency of pricePerKg, for labelling the result"),
  saWeightKg: z
    .number()
    .min(1.5)
    .max(4)
    .optional()
    .describe(
      "Weight of one sa' in kg if the user follows a specific figure. Defaults to 3 kg.",
    ),
});

export const zakatAlFitr = (input: z.input<typeof zakatAlFitrInput>) => {
  const { people, pricePerKg, currency, saWeightKg } =
    zakatAlFitrInput.parse(input);
  const sa = saWeightKg ?? UNITS.sa.grams / 1000;
  const cost = (kgPerPerson: number) =>
    pricePerKg === undefined
      ? null
      : {
          currency: currency ?? null,
          perPerson: round(kgPerPerson * pricePerKg, 2),
          total: round(kgPerPerson * pricePerKg * people, 2),
        };
  return {
    people,
    saWeightKg: sa,
    isEstimate: true,
    majority: {
      schools: "Maliki, Shafi'i, Hanbali",
      rule: "One full sa' of staple food per person (dates, barley, raisins, wheat, rice or the local staple). The majority require food, not its cash value.",
      kgPerPerson: round(sa, 3),
      totalKg: round(sa * people, 3),
      estimatedCost: cost(sa),
    },
    hanafi: {
      schools: "Hanafi",
      rule: "Half a sa' of wheat or wheat flour, or one full sa' of dates, barley or raisins, per person. The Hanafi school allows paying the cash value instead of the food.",
      wheatKgPerPerson: HANAFI_HALF_SA_WHEAT_KG,
      totalWheatKg: round(HANAFI_HALF_SA_WHEAT_KG * people, 3),
      estimatedCost: cost(HANAFI_HALF_SA_WHEAT_KG),
    },
    basis: `Hadith of Ibn 'Umar (Bukhari, Muslim): the Prophet made zakat al-fitr obligatory, one sa' of dates or one sa' of barley, on every Muslim, young or old, free or slave. The weight of a sa' is assumed to be ${sa} kg here.`,
    caveats: [
      "This is an estimate. The sa' is a measure of volume, so its weight depends on the food. Often cited figures run from about 2.5 kg to 3 kg, and some give about 2 kg for wheat. Follow the figure your local scholars or mosque give.",
      "The Hanafi figure of about 1.63 kg of wheat for half a sa' is the commonly cited Hanafi value and is also approximate. Some give up to 2 kg.",
      "It is due from the payer for themselves and for dependants. Pay it before the Eid prayer; paid after the prayer it counts only as ordinary charity.",
      "Cash is accepted in the Hanafi school. The majority view requires food, so a Shafi'i, Maliki or Hanbali payer should give food, or give the money to someone who buys and hands over the food.",
    ],
  };
};
