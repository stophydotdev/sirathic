import { z } from "zod";
import { cacheFor } from "../cache";
import { stophy } from "../stophy";

const DAY_MS = 24 * 60 * 60_000;

export const imageSearchInput = z.object({
  query: z.string().trim().min(2).max(200),
  limit: z.number().int().min(1).max(30).default(20),
});

const images = z.array(
  z.object({
    imageUrl: z.string(),
    thumbnailUrl: z.string(),
    pageUrl: z.string(),
    title: z.string().optional(),
    source: z.string().optional(),
    width: z.number(),
    height: z.number(),
  }),
);

const imageCache = cacheFor({
  namespace: "images:v1",
  schema: images,
  freshMs: DAY_MS,
  keepMs: 7 * DAY_MS,
});

export const imageSearch = async (input: z.input<typeof imageSearchInput>) => {
  const { query, limit } = imageSearchInput.parse(input);
  return imageCache(`${limit}:${query.toLowerCase()}`, async () => {
    const { data } = await stophy.web.images({
      query,
      safeSearch: true,
      limit,
    });
    return data.results;
  });
};
