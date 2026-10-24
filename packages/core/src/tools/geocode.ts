import { z } from "zod";
import { cacheFor } from "../cache";
import { getJson } from "../web/getJson";

const API = "https://geocoding-api.open-meteo.com/v1/search";
const SOURCE = "Open-Meteo Geocoding API (GeoNames data, CC BY 4.0)";
const FETCH_COUNT = 10;
const MAX_CANDIDATES = 5;
const DAY_MS = 24 * 60 * 60_000;

export const geocodeInput = z.object({
  place: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .describe('Place name, optionally with a country: "London" or "Dhaka, Bangladesh"'),
});

const candidate = z.object({
  name: z.string(),
  admin1: z.string().nullable(),
  country: z.string(),
  countryCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  population: z.number().nullable(),
});

const geocodeResult = z.object({
  query: z.string(),
  best: candidate.nullable(),
  candidates: candidate.array(),
  ambiguous: z.boolean(),
  source: z.string(),
});

const openMeteoResponse = z.object({
  results: z.unknown().array().default([]),
});

const openMeteoPlace = z
  .object({
    name: z.string(),
    admin1: z.string().optional(),
    country: z.string(),
    country_code: z.string().default(""),
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string(),
    population: z.number().optional(),
  })
  .transform((raw): z.infer<typeof candidate> => ({
    name: raw.name,
    admin1: raw.admin1 ?? null,
    country: raw.country,
    countryCode: raw.country_code,
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone,
    population: raw.population ?? null,
  }));

const geocodeCache = cacheFor({
  namespace: "geocode:v1",
  schema: geocodeResult,
  freshMs: 30 * DAY_MS,
  keepMs: 90 * DAY_MS,
});

const matchesHint = ({ country, countryCode, admin1 }: z.infer<typeof candidate>, hint: string) =>
  [country, countryCode, admin1 ?? ""].some((field) => {
    const value = field.toLowerCase();
    return value === hint || (hint.length > 3 && value.includes(hint));
  });

const search = async (place: string) => {
  const [name = "", ...rest] = place.split(",");
  const hint = rest.join(" ").trim().toLowerCase();
  const { results } = await getJson(
    `${API}?${new URLSearchParams({ name: name.trim(), count: String(FETCH_COUNT), language: "en", format: "json" })}`,
    openMeteoResponse,
    { timeoutMs: 8_000 },
  );
  const all = results.flatMap((raw) => {
    const parsed = openMeteoPlace.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
  const hinted = hint === "" ? all : all.filter((c) => matchesHint(c, hint));
  const candidates = (hinted.length > 0 ? hinted : all).slice(0, MAX_CANDIDATES);
  const best = candidates[0] ?? null;
  const sameName = candidates.filter((c) => c.name.toLowerCase() === best?.name.toLowerCase());
  return {
    query: place,
    best,
    candidates,
    ambiguous: sameName.length > 1,
    source: SOURCE,
  };
};

export const geocode = async (input: z.input<typeof geocodeInput>) => {
  const { place } = geocodeInput.parse(input);
  return geocodeCache(place.toLowerCase().replaceAll(/\s+/gu, " "), () => search(place));
};
