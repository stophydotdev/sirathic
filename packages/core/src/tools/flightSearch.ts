import { z } from "zod";
import { stophy } from "../stophy";

const FLIGHTS = 8;
const AIRPORT = /^[A-Za-z]{3}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export const flightSearchInput = z.object({
  origin: z.string().regex(AIRPORT).describe("IATA airport code, like LHR"),
  destination: z
    .string()
    .regex(AIRPORT)
    .describe("IATA airport code, like JED"),
  departDate: z.string().regex(DATE).describe("YYYY-MM-DD"),
  returnDate: z
    .string()
    .regex(DATE)
    .optional()
    .describe("YYYY-MM-DD, for a round trip"),
  adults: z.number().int().min(1).max(9).default(1),
  cabin: z
    .enum(["economy", "premiumEconomy", "business", "first"])
    .default("economy"),
  stops: z
    .enum(["any", "nonstop", "oneStopOrFewer", "twoStopsOrFewer"])
    .default("any"),
});

const hours = (seconds: number | undefined) =>
  seconds === undefined ? null : Math.round(seconds / 360) / 10;

export const flightSearch = async (
  input: z.input<typeof flightSearchInput>,
) => {
  const query = flightSearchInput.parse(input);
  const { data } = await stophy.google.flights(query);
  const flights = data.results.slice(0, FLIGHTS).map((flight) => ({
    best: flight.isBest ?? false,
    price: flight.price ?? null,
    currency: flight.priceCurrency ?? "USD",
    airlines: flight.airlines ?? [],
    stops: flight.stops ?? null,
    durationHours: hours(flight.durationSeconds),
    departure: flight.departureLocalTime ?? null,
    arrival: flight.arrivalLocalTime ?? null,
    flightNumbers: (flight.legs ?? []).map((leg) => leg.flightNumber),
    layovers: (flight.layovers ?? []).map(
      (layover) =>
        `${layover.airport}, ${Math.round((layover.durationSeconds ?? 0) / 60)} min`,
    ),
  }));
  return { ...query, flights };
};
