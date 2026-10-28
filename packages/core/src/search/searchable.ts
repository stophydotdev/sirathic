import {
  duas,
  EMBEDDING,
  BGE_M3,
  fatwas,
  fiqhPassages,
  hadiths,
  verses,
} from "@sirathic/db/schema";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Embedder } from "./embedding";

export type Searchable = {
  table: PgTable & { id: AnyPgColumn; search: AnyPgColumn };
  embedding: AnyPgColumn;
  embedder: Embedder;
};

export const SEARCHABLE = {
  verses: { table: verses, embedding: verses.embedding, embedder: EMBEDDING },
  hadiths: { table: hadiths, embedding: hadiths.embedding, embedder: EMBEDDING },
  duas: { table: duas, embedding: duas.embedding, embedder: EMBEDDING },
  fiqhPassages: { table: fiqhPassages, embedding: fiqhPassages.embeddingM3, embedder: BGE_M3 },
  fatwas: { table: fatwas, embedding: fatwas.embeddingM3, embedder: BGE_M3 },
} satisfies Record<string, Searchable>;
