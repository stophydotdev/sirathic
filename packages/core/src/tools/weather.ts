import { z } from "zod";
import { cacheFor } from "../cache";
import { getJson } from "../web/getJson";

const API = "https://api.open-meteo.com/v1/forecast";
const SOURCE = "Open-Meteo Weather API (free tier: non-commercial use)";
const FORECAST_DAYS = 3;

export const weatherInput = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  units: z.enum(["metric", "imperial"]).default("metric"),
});

const CONDITIONS = new Map([
  [0, "Clear sky"],
  [1, "Mainly clear"],
  [2, "Partly cloudy"],
  [3, "Overcast"],
  [45, "Fog"],
  [48, "Depositing rime fog"],
  [51, "Light drizzle"],
  [53, "Moderate drizzle"],
  [55, "Dense drizzle"],
  [56, "Light freezing drizzle"],
  [57, "Dense freezing drizzle"],
  [61, "Slight rain"],
  [63, "Moderate rain"],
  [65, "Heavy rain"],
  [66, "Light freezing rain"],
  [67, "Heavy freezing rain"],
  [71, "Slight snow"],
  [73, "Moderate snow"],
  [75, "Heavy snow"],
  [77, "Snow grains"],
  [80, "Slight rain showers"],
  [81, "Moderate rain showers"],
  [82, "Violent rain showers"],
  [85, "Slight snow showers"],
  [86, "Heavy snow showers"],
  [95, "Thunderstorm"],
  [96, "Thunderstorm with slight hail"],
  [99, "Thunderstorm with heavy hail"],
]);

const condition = (code: number) => CONDITIONS.get(code) ?? "Unknown";

const forecast = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number(),
  timezone: z.string(),
  current_units: z.object({
    temperature_2m: z.string(),
    wind_speed_10m: z.string(),
    precipitation: z.string(),
  }),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    precipitation: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    is_day: z.number(),
  }),
  daily: z.object({
    time: z.string().array(),
    weather_code: z.number().array(),
    temperature_2m_max: z.number().array(),
    temperature_2m_min: z.number().array(),
    precipitation_sum: z.number().array(),
    precipitation_probability_max: z.number().nullable().array(),
    sunrise: z.string().array(),
    sunset: z.string().array(),
  }),
});

const weatherResult = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  elevationMeters: z.number(),
  units: z.object({
    temperature: z.string(),
    windSpeed: z.string(),
    precipitation: z.string(),
  }),
  current: z.object({
    time: z.string(),
    temperature: z.number(),
    feelsLike: z.number(),
    humidityPercent: z.number(),
    precipitation: z.number(),
    windSpeed: z.number(),
    windDirectionDegrees: z.number(),
    isDay: z.boolean(),
    weatherCode: z.number(),
    condition: z.string(),
  }),
  daily: z
    .object({
      date: z.string(),
      weatherCode: z.number(),
      condition: z.string(),
      temperatureMax: z.number(),
      temperatureMin: z.number(),
      precipitationSum: z.number(),
      precipitationProbabilityMaxPercent: z.number().nullable(),
      sunrise: z.string(),
      sunset: z.string(),
    })
    .array(),
  source: z.string(),
});

const weatherCache = cacheFor({
  namespace: "weather:v1",
  schema: weatherResult,
  freshMs: 15 * 60_000,
  keepMs: 6 * 60 * 60_000,
});

const fetchWeather = async ({
  latitude,
  longitude,
  units,
}: z.infer<typeof weatherInput>) => {
  const imperial = units === "imperial";
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset",
    forecast_days: String(FORECAST_DAYS),
    timezone: "auto",
    temperature_unit: imperial ? "fahrenheit" : "celsius",
    wind_speed_unit: imperial ? "mph" : "kmh",
    precipitation_unit: imperial ? "inch" : "mm",
  });
  const { current, daily, ...place } = await getJson(
    `${API}?${params}`,
    forecast,
    { timeoutMs: 8_000 },
  );
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone,
    elevationMeters: place.elevation,
    units: {
      temperature: place.current_units.temperature_2m,
      windSpeed: place.current_units.wind_speed_10m,
      precipitation: place.current_units.precipitation,
    },
    current: {
      time: current.time,
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidityPercent: current.relative_humidity_2m,
      precipitation: current.precipitation,
      windSpeed: current.wind_speed_10m,
      windDirectionDegrees: current.wind_direction_10m,
      isDay: current.is_day === 1,
      weatherCode: current.weather_code,
      condition: condition(current.weather_code),
    },
    daily: daily.time.map((date, day) => ({
      date,
      weatherCode: daily.weather_code[day],
      condition: condition(daily.weather_code[day]),
      temperatureMax: daily.temperature_2m_max[day],
      temperatureMin: daily.temperature_2m_min[day],
      precipitationSum: daily.precipitation_sum[day],
      precipitationProbabilityMaxPercent:
        daily.precipitation_probability_max[day],
      sunrise: daily.sunrise[day],
      sunset: daily.sunset[day],
    })),
    source: SOURCE,
  };
};

export const weather = async (input: z.input<typeof weatherInput>) => {
  const parsed = weatherInput.parse(input);
  const key = `${parsed.latitude.toFixed(2)},${parsed.longitude.toFixed(2)}:${parsed.units}`;
  return weatherCache(key, () => fetchWeather(parsed));
};
