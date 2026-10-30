import { BROWSER_TOOLS } from "../../bots/browser";
import type { Skill } from "./builtIn";
import accommodationBooking from "./accommodationBooking.md" with { type: "text" };
import flightBooking from "./flightBooking.md" with { type: "text" };
import restaurantBooking from "./restaurantBooking.md" with { type: "text" };
import airbnb from "./sites/airbnb.md" with { type: "text" };
import expedia from "./sites/expedia.md" with { type: "text" };
import googleFlights from "./sites/googleFlights.md" with { type: "text" };
import opentable from "./sites/opentable.md" with { type: "text" };
import resy from "./sites/resy.md" with { type: "text" };
import southwest from "./sites/southwest.md" with { type: "text" };
import united from "./sites/united.md" with { type: "text" };

const SITE_GUIDES = [
  {
    name: "opentable",
    when: "OpenTable: open tables at a restaurant or in an area, and booking one",
    text: opentable,
  },
  {
    name: "resy",
    when: "Resy: a restaurant's open tables from Resy's API, and booking one",
    text: resy,
  },
  {
    name: "google_flights",
    when: "Google Flights: cheapest fares or itineraries on a route",
    text: googleFlights,
  },
  {
    name: "united",
    when: "United: cash fares or awards, not a booked trip, upgrades or check-in",
    text: united,
  },
  {
    name: "southwest",
    when: "Southwest: fares or itineraries, not booking, check-in or changes",
    text: southwest,
  },
  { name: "expedia", when: "Expedia: compare flights, hotels, or travel options", text: expedia },
  {
    name: "airbnb",
    when: "Airbnb: search stays or read one listing page, not host tools",
    text: airbnb,
  },
];

export const bookingSkills: Skill[] = [
  {
    name: "restaurant_booking",
    when: "Load when the user asks you to book, reserve, or hold a restaurant table, check what times a named restaurant has open, or find somewhere with a table for a given night and party, before you open any reservation site",
    text: restaurantBooking,
    tools: BROWSER_TOOLS,
  },
  {
    name: "flight_booking",
    when: "Load when the user asks you to find, compare, book, change, or check in for a flight, look up an itinerary, or fetch a boarding pass, before you search any airline or travel site or touch a checkout",
    text: flightBooking,
    tools: BROWSER_TOOLS,
  },
  {
    name: "accommodation_booking",
    when: "Load when the user asks you to find, compare, book, or change a vacation rental, hotel room, or other place to stay for a trip, or asks what a listing costs for their dates, before you open Airbnb, Expedia, or any other lodging site",
    text: accommodationBooking,
    tools: BROWSER_TOOLS,
  },
  ...SITE_GUIDES.map(({ name, when, text }) => ({
    name,
    when: `Site guide for ${when}. Load before you open it in your browser`,
    text,
    tools: BROWSER_TOOLS,
  })),
];
