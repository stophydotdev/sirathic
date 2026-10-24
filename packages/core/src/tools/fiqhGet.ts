import { db } from "@sirathic/db";
import { fiqhPassages, fiqhWorks } from "@sirathic/db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

export const fiqhGetInput = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(20),
});

export const SHAMELA_BOOKS = new Map([
  ["shamela.5841", 21739],
  ["shamela.4404", 11820],
  ["shamela.5775", 21613],
  ["shamela.4226", 11355],
  ["shamela.566", 587],
  ["shamela.5768", 21604],
  ["shamela.4288", 11444],
  ["shamela.480", 499],
  ["shamela.1456", 1679],
  ["shamela.2437", 6910],
  ["shamela.598", 622],
]);

const pageUrl = (workId: string, volume: number, page: number) => {
  const book = SHAMELA_BOOKS.get(workId);
  return book === undefined ? null : `https://shamela.ws/book/${book}#${volume}:${page}`;
};

export const passagesByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: fiqhPassages.id,
      workId: fiqhPassages.workId,
      school: fiqhPassages.school,
      work: fiqhWorks.titleAr,
      author: fiqhWorks.authorAr,
      deathYearAh: fiqhWorks.deathYearAh,
      volume: fiqhPassages.volume,
      page: fiqhPassages.page,
      heading: fiqhPassages.heading,
      textAr: fiqhPassages.textAr,
    })
    .from(fiqhPassages)
    .innerJoin(fiqhWorks, eq(fiqhPassages.workId, fiqhWorks.id))
    .where(inArray(fiqhPassages.id, ids));
  const byId = new Map(
    rows.map((row) => [
      row.id,
      Object.assign(row, { url: pageUrl(row.workId, row.volume, row.page) }),
    ]),
  );
  return ids.flatMap((id) => byId.get(id) ?? []);
};

export const fiqhGet = async (input: z.input<typeof fiqhGetInput>) => {
  const { ids } = fiqhGetInput.parse(input);
  const found = await passagesByIds(ids);
  const foundIds = new Set(found.map((passage) => passage.id));
  return { passages: found, missing: ids.filter((id) => !foundIds.has(id)) };
};
