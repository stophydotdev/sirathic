import { env } from "@sirathic/env/server";
import { z } from "zod";
import { cacheFor } from "../cache";

const API = "https://api.stophy.dev/v1/web/images";
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

const imagesResponse = z.object({ data: z.object({ results: images }) });

const imageCache = cacheFor({
  namespace: "images:v1",
  schema: images,
  freshMs: DAY_MS,
  keepMs: 7 * DAY_MS,
});

export const imageSearch = async (input: z.input<typeof imageSearchInput>) => {
  const { query, limit } = imageSearchInput.parse(input);
  return imageCache(`${limit}:${query.toLowerCase()}`, async () => {
    const response = await fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.STOPHY_API_KEY && {
          authorization: `Bearer ${env.STOPHY_API_KEY}`,
        }),
      },
      body: JSON.stringify({ query, safeSearch: true, limit }),
    });
    if (!response.ok) {
      throw new Error(`Image search failed with ${response.status}`);
    }
    return imagesResponse.parse(await response.json()).data.results;
  });
};
