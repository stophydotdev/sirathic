import { z } from "zod";

const LOOKUP_URL = "https://ipinfo.io/json";
const LOOKUP_MS = 5_000;
const answer = z.object({ timezone: z.string() });

const lookup = async () => {
  const response = await fetch(LOOKUP_URL, { signal: AbortSignal.timeout(LOOKUP_MS) });
  return answer.parse(await response.json()).timezone;
};

let zone: Promise<string | undefined> | undefined;

export const exitZone = () =>
  (zone ??= lookup().catch((error: Error) => {
    zone = undefined;
    console.error(`exit timezone not looked up, leaving the clock alone: ${error.message}`);
    return undefined;
  }));
