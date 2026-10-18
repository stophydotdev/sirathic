import { z } from "zod";
import { cacheFor } from "../cache";
import { stophy } from "../stophy";

const SOURCE = "Google Maps via Stophy";
const MAX_RADIUS_METERS = 5_000;
const MAX_LIMIT = 25;
const EARTH_RADIUS_METERS = 6_371_000;
const HOUR_MS = 60 * 60_000;

const QUERIES = {
  mosque: "mosque",
  halal_food: "halal restaurant",
  islamic_school: "islamic school",
} as const;

export const placesNearInput = z.object({
  kind: z.enum(["mosque", "halal_food", "islamic_school"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(100).max(MAX_RADIUS_METERS).default(2_000),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(10),
});

const place = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  rating: z.number().nullable(),
  reviews: z.number().nullable(),
  hoursToday: z.string().nullable(),
  openStatus: z.string().nullable(),
});

const placesCache = cacheFor({
  namespace: "places:v2",
  schema: place.array(),
  freshMs: 6 * HOUR_MS,
  keepMs: 3 * 24 * HOUR_MS,
});

const radians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineMeters = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) => {
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
};

const findPlaces = async (
  kind: keyof typeof QUERIES,
  latitude: number,
  longitude: number,
) => {
  const { data } = await stophy.google.maps.search({
    query: QUERIES[kind],
    location: `${latitude},${longitude}`,
  });
  return data.results.flatMap((found) =>
    found.latitude === undefined || found.longitude === undefined
      ? []
      : [
          {
            url: found.placeUrl,
            title: found.name ?? "",
            description: [found.categories?.join(", "), found.address]
              .filter(Boolean)
              .join(" · "),
            latitude: found.latitude,
            longitude: found.longitude,
            rating: found.rating ?? null,
            reviews: found.reviews ?? null,
            hoursToday: found.hoursToday ?? null,
            openStatus: found.openStatus ?? null,
          },
        ],
  );
};

export const placesNear = async (input: z.input<typeof placesNearInput>) => {
  const parsed = placesNearInput.parse(input);
  const latitude = Number(parsed.latitude.toFixed(4));
  const longitude = Number(parsed.longitude.toFixed(4));
  const { kind, radiusMeters, limit } = parsed;
  const found = await placesCache(`${kind}:${latitude}:${longitude}`, () =>
    findPlaces(kind, latitude, longitude),
  );
  const center = { latitude, longitude };
  const places = found
    .map((nearby) =>
      Object.assign(nearby, {
        distanceMeters: Math.round(haversineMeters(center, nearby)),
      }),
    )
    .filter((nearby) => nearby.distanceMeters <= radiusMeters)
    .toSorted((a, b) => a.distanceMeters - b.distanceMeters);
  return {
    kind,
    center,
    radiusMeters,
    places: places.slice(0, limit),
    totalFound: places.length,
    mapUrl: `https://www.google.com/maps/search/${encodeURIComponent(QUERIES[kind])}/@${latitude},${longitude},15z`,
    source: SOURCE,
  };
};
