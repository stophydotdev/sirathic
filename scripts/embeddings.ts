import {
  duas,
  EMBEDDING,
  fatwas,
  fiqhPassages,
  hadiths,
  REDDIT_EMBEDDING_DIMENSIONS,
  redditThreads,
  verses,
} from "@sirathic/db/schema";
import { sql } from "drizzle-orm";

const FULL = EMBEDDING.dimensions;

export const EMBEDDED = {
  verses: {
    table: verses,
    text: sql<string>`${verses.textEn}`,
    dimensions: FULL,
  },
  hadiths: {
    table: hadiths,
    text: sql<string>`coalesce(${hadiths.textEn}, ${hadiths.textArClean})`,
    dimensions: FULL,
  },
  duas: {
    table: duas,
    text: sql<string>`concat_ws(' ', array_to_string(${duas.occasions}, ', '), ${duas.title}, ${duas.textEn}, ${duas.textArClean})`,
    dimensions: FULL,
  },
  fiqhPassages: {
    table: fiqhPassages,
    text: sql<string>`left(${fiqhPassages.textArClean}, 8000)`,
    dimensions: FULL,
  },
  fatwas: {
    table: fatwas,
    text: sql<string>`concat_ws(' ', ${fatwas.title}, left(coalesce(${fatwas.question}, ${fatwas.answer}), 1500))`,
    dimensions: FULL,
  },
  redditThreads: {
    table: redditThreads,
    text: sql<string>`concat_ws(' ', ${redditThreads.title}, left(${redditThreads.question}, 1500))`,
    dimensions: REDDIT_EMBEDDING_DIMENSIONS,
  },
} as const;
