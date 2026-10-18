import { z } from "zod";
import { cacheFor } from "../cache";
import { getJson } from "../web/getJson";

const API = "https://open.er-api.com/v6/latest";
const SOURCE = "ExchangeRate-API open access (open.er-api.com)";
const ATTRIBUTION =
  "Rates By Exchange Rate API - https://www.exchangerate-api.com";
const HOUR_MS = 60 * 60_000;

const currencyCode = z
  .string()
  .regex(/^[A-Za-z]{3}$/u)
  .transform((code) => code.toUpperCase());

export const currencyConvertInput = z.object({
  amount: z.number().finite().nonnegative(),
  from: currencyCode.describe("ISO 4217 code such as USD"),
  to: currencyCode.describe("ISO 4217 code such as SAR"),
});

const rateTable = z.object({
  updatedAt: z.number(),
  rates: z.record(z.string(), z.number()),
});

const exchangeRateResponse = z.discriminatedUnion("result", [
  z
    .object({
      result: z.literal("success"),
      time_last_update_unix: z.number(),
      rates: z.record(z.string(), z.number()),
    })
    .transform(
      ({ time_last_update_unix, rates }): z.infer<typeof rateTable> => ({
        updatedAt: time_last_update_unix * 1000,
        rates,
      }),
    ),
  z.object({ result: z.literal("error") }).transform(() => null),
]);

const tableCache = cacheFor({
  namespace: "fx:er-api:v1",
  schema: rateTable,
  freshMs: HOUR_MS,
  keepMs: 3 * 24 * HOUR_MS,
});

const significant = (value: number) => Number(value.toPrecision(10));

export const currencyConvert = async (
  input: z.input<typeof currencyConvertInput>,
) => {
  const { amount, from, to } = currencyConvertInput.parse(input);
  const { updatedAt, rates } = await tableCache(from, async () => {
    const response = await getJson(`${API}/${from}`, exchangeRateResponse, {
      timeoutMs: 8_000,
    });
    if (response === null) {
      throw new Error(`Unknown currency code: ${from}`);
    }
    return response;
  });
  const rate = rates[to];
  if (rate === undefined) throw new Error(`Unknown currency code: ${to}`);
  return {
    amount,
    from,
    to,
    rate: significant(rate),
    result: significant(amount * rate),
    rateDate: new Date(updatedAt).toISOString().slice(0, 10),
    source: SOURCE,
    attribution: ATTRIBUTION,
  };
};
