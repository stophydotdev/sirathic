import { Coordinates, Qibla } from "adhan";
import { z } from "zod";
import { latitudeSchema, longitudeSchema, round } from "../zoned";

const KAABA = { latitude: 21.4225241, longitude: 39.8261818 };
const EARTH_RADIUS_KM = 6371.0088;
const AT_THE_KAABA_KM = 0.5;

export const qiblaInput = z.object({
  latitude: latitudeSchema.describe("Latitude of the user in decimal degrees"),
  longitude: longitudeSchema.describe(
    "Longitude of the user in decimal degrees",
  ),
});

const COMPASS_POINTS = [
  "north",
  "north-northeast",
  "northeast",
  "east-northeast",
  "east",
  "east-southeast",
  "southeast",
  "south-southeast",
  "south",
  "south-southwest",
  "southwest",
  "west-southwest",
  "west",
  "west-northwest",
  "northwest",
  "north-northwest",
] as const;

const compassPoint = (bearing: number) =>
  COMPASS_POINTS[Math.round(bearing / 22.5) % COMPASS_POINTS.length];

const radians = (degrees: number) => (degrees * Math.PI) / 180;

const distanceToKaabaKm = (latitude: number, longitude: number) => {
  const dLat = radians(KAABA.latitude - latitude);
  const dLon = radians(KAABA.longitude - longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(latitude)) *
      Math.cos(radians(KAABA.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

export const qibla = (input: z.input<typeof qiblaInput>) => {
  const { latitude, longitude } = qiblaInput.parse(input);
  const distanceKm = distanceToKaabaKm(latitude, longitude);
  const bearing = Qibla(new Coordinates(latitude, longitude));
  const atTheKaaba = distanceKm < AT_THE_KAABA_KM;
  return {
    latitude,
    longitude,
    bearingDegrees: round(bearing, 2),
    compass: compassPoint(bearing),
    distanceToKaabaKm: Math.round(distanceKm),
    atTheKaaba,
    basis: `Initial great-circle bearing from the location to the Kaaba (${KAABA.latitude}, ${KAABA.longitude}), in degrees clockwise from true north.`,
    caveats: [
      "The bearing is from true north. A magnetic compass points to magnetic north, so correct for local magnetic declination or use a phone compass that does.",
      ...(atTheKaaba
        ? ["The location is at the Kaaba, so the bearing has no meaning."]
        : []),
    ],
  };
};
