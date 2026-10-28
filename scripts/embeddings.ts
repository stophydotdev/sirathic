import { SEARCHABLE } from "@sirathic/core/search/searchable";
import { sql } from "drizzle-orm";

const { verses, hadiths, duas, fiqhPassages, fatwas } = SEARCHABLE;

export const EMBEDDED = {
  verses: {
    ...verses,
    text: sql<string>`${verses.table.textEn}`,
    dimensions: verses.embedder.dimensions,
  },
  hadiths: {
    ...hadiths,
    text: sql<string>`coalesce(${hadiths.table.textEn}, ${hadiths.table.textArClean})`,
    dimensions: hadiths.embedder.dimensions,
  },
  duas: {
    ...duas,
    text: sql<string>`concat_ws(' ', array_to_string(${duas.table.occasions}, ', '), ${duas.table.title}, ${duas.table.textEn}, ${duas.table.textArClean})`,
    dimensions: duas.embedder.dimensions,
  },
  fiqhPassages: {
    ...fiqhPassages,
    text: sql<string>`left(${fiqhPassages.table.textArClean}, 8000)`,
    dimensions: fiqhPassages.embedder.dimensions,
  },
  fatwas: {
    ...fatwas,
    text: sql<string>`concat_ws(' ', ${fatwas.table.title}, left(coalesce(${fatwas.table.question}, ${fatwas.table.answer}), 1500))`,
    dimensions: fatwas.embedder.dimensions,
  },
} as const;
