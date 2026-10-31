import { hadiths } from "@sirathic/db/schema";
import { notInArray, sql } from "drizzle-orm";
import unverified from "./unverifiedHadith.json";

const unverifiedIds = Object.entries(unverified.ids).flatMap(([book, numbers]) =>
  numbers.split(" ").map((number) => `${book}:${number}`),
);

export const trustedHadith = {
  where: sql`${notInArray(hadiths.book, unverified.books)} and ${notInArray(hadiths.id, unverifiedIds)}`,
  key: `trusted:${Bun.hash(JSON.stringify(unverified))}`,
};
