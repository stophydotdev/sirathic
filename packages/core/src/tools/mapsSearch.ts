import { z } from "zod";
import { stophy } from "../stophy";

export const mapsSearchInput = z.object({
  query: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe(
      "What to find, like halal restaurants, mosque or Islamic bookshop",
    ),
  location: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe("City, area or address, like Leeds, UK"),
  openNow: z.boolean().default(false),
  minRating: z.union([z.literal(3.5), z.literal(4), z.literal(4.5)]).optional(),
  limit: z.number().int().min(1).max(10).default(6),
});

export const mapsSearch = async (input: z.input<typeof mapsSearchInput>) => {
  const { query, location, openNow, minRating, limit } =
    mapsSearchInput.parse(input);
  const { data } = await stophy.google.maps.search({
    query,
    location,
    openNow,
    minRating,
  });
  const places = data.results.slice(0, limit).map((place) => ({
    url: place.placeUrl,
    title: place.name ?? "",
    description: [place.categories?.join(", "), place.address]
      .filter(Boolean)
      .join(" · "),
    address: place.address ?? null,
    rating: place.rating ?? null,
    reviews: place.reviews ?? null,
    phone: place.phone ?? null,
    website: place.website ?? null,
    hoursToday: place.hoursToday ?? null,
    openStatus: place.openStatus ?? null,
  }));
  return { query, location, places };
};
