import { z } from "zod";
import { round } from "../zoned";

const unitNames = [
  "gram",
  "kilogram",
  "troy_ounce",
  "tola",
  "mithqal",
  "dinar",
  "dirham",
  "qirat",
  "daniq",
  "nash",
  "awqiyah",
  "sa",
  "mudd",
  "wasaq",
] as const;

const unitNameSchema = z.enum(unitNames);

type UnitName = z.infer<typeof unitNameSchema>;

type Unit = {
  label: string;
  grams: number;
  approximate: boolean;
  note: string;
};

const SA_NOTE =
  "A sa' is a measure of volume, so its weight depends on the food. Scholars and bodies give about 2.0 kg (wheat) up to about 3.0 kg (rice, dates). 3 kg is assumed here.";

export const UNITS = {
  gram: { label: "gram", grams: 1, approximate: false, note: "SI unit." },
  kilogram: {
    label: "kilogram",
    grams: 1000,
    approximate: false,
    note: "SI unit.",
  },
  troy_ounce: {
    label: "troy ounce",
    grams: 31.1034768,
    approximate: false,
    note: "The unit gold and silver spot prices are quoted in.",
  },
  tola: {
    label: "tola",
    grams: 11.664,
    approximate: false,
    note: "South Asian unit. Some Hanafi bodies there give the nisab as 7.5 tola of gold (87.48 g) and 52.5 tola of silver (612.36 g).",
  },
  mithqal: {
    label: "mithqal",
    grams: 4.25,
    approximate: false,
    note: "Common modern value. Sources differ: South Asian Hanafi references use about 4.374 g (the tola-based value).",
  },
  dinar: {
    label: "dinar (gold)",
    grams: 4.25,
    approximate: false,
    note: "The shar'i gold dinar equals one mithqal. 20 dinars (85 g) is the gold nisab.",
  },
  dirham: {
    label: "dirham (silver)",
    grams: 2.975,
    approximate: false,
    note: "The shar'i silver dirham is 7/10 of a mithqal. 200 dirhams (595 g) is the silver nisab.",
  },
  qirat: {
    label: "qirat",
    grams: 0.2125,
    approximate: true,
    note: "One twentieth of a dinar in the fiqh convention. Some regions use 24 qirat to the mithqal (about 0.177 g). Sources differ.",
  },
  daniq: {
    label: "daniq",
    grams: 2.975 / 6,
    approximate: false,
    note: "One sixth of a dirham.",
  },
  nash: {
    label: "nash",
    grams: 59.5,
    approximate: false,
    note: "Twenty dirhams, half an awqiyah.",
  },
  awqiyah: {
    label: "awqiyah (uqiyyah)",
    grams: 119,
    approximate: false,
    note: "Forty dirhams. Five awaq (200 dirhams) is the silver nisab.",
  },
  sa: {
    label: "sa'",
    grams: 3000,
    approximate: true,
    note: SA_NOTE,
  },
  mudd: {
    label: "mudd",
    grams: 750,
    approximate: true,
    note: "A quarter of a sa', so it carries the same uncertainty about weight.",
  },
  wasaq: {
    label: "wasaq",
    grams: 180_000,
    approximate: true,
    note: "Sixty sa'. Five wasaq (300 sa') is the nisab for crops. Weight depends on the crop and on the sa' assumed.",
  },
} satisfies Record<UnitName, Unit>;

export const NISAB_GOLD_GRAMS = 85;
export const NISAB_SILVER_GRAMS = 595;

export const islamicUnitsInput = z.object({
  value: z.number().describe("Amount to convert"),
  from: unitNameSchema.describe("Unit of the amount"),
  to: unitNameSchema.describe("Unit to convert to"),
});

export const islamicUnits = (input: z.input<typeof islamicUnitsInput>) => {
  const { value, from, to } = islamicUnitsInput.parse(input);
  const result = (value * UNITS[from].grams) / UNITS[to].grams;
  const assumptions = [...new Set([from, to])].map((unit) => ({
    unit,
    label: UNITS[unit].label,
    gramsPerUnit: UNITS[unit].grams,
    approximate: UNITS[unit].approximate,
    note: UNITS[unit].note,
  }));
  return {
    value,
    from,
    to,
    result: round(result, 6),
    assumptions,
    caveats: [
      "Sources differ on these values, so the assumptions above are stated rather than hidden.",
      ...(assumptions.some((entry) => entry.approximate)
        ? [
            "At least one unit here is an approximation. Treat the result as an estimate.",
          ]
        : []),
    ],
  };
};
