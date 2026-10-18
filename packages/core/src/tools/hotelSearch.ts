import { z } from "zod";
import { stophy } from "../stophy";

const HOTELS = 8;
const AMENITIES = 8;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export const hotelSearchInput = z.object({
  query: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe("Where to stay, like hotels near Masjid al-Haram, Makkah"),
  checkIn: z.string().regex(DATE).optional().describe("YYYY-MM-DD"),
  checkOut: z.string().regex(DATE).optional().describe("YYYY-MM-DD"),
  adults: z.number().int().min(1).max(12).default(2),
  maxPrice: z.number().int().positive().optional().describe("Per night"),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/u)
    .default("USD"),
  minRating: z.enum(["3.5+", "4+", "4.5+"]).optional(),
  sort: z
    .enum(["relevance", "lowestPrice", "highestRating", "mostReviewed"])
    .default("relevance"),
});

export const hotelSearch = async (input: z.input<typeof hotelSearchInput>) => {
  const query = hotelSearchInput.parse(input);
  const { data } = await stophy.google.hotels(query);
  const hotels = data.results.slice(0, HOTELS).map((hotel) => ({
    url: hotel.hotelUrl,
    title: hotel.name,
    description: [
      hotel.price === undefined
        ? undefined
        : `${hotel.price} ${hotel.priceCurrency ?? query.currency} a night`,
      hotel.rating === undefined ? undefined : `rated ${hotel.rating}`,
    ]
      .filter(Boolean)
      .join(", "),
    pricePerNight: hotel.price ?? null,
    totalPrice: hotel.totalPrice ?? null,
    currency: hotel.priceCurrency ?? query.currency,
    rating: hotel.rating ?? null,
    reviews: hotel.reviews ?? null,
    stars: hotel.hotelClass ?? null,
    amenities: (hotel.amenities ?? []).slice(0, AMENITIES),
  }));
  return {
    query: query.query,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    hotels,
  };
};
