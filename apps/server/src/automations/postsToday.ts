import { dayState } from "../bots/islamicDates";
import { yesChances } from "../chat/clef";
import { reasonOf } from "../http";

const SKIP_BELOW = 0.05;
const DAY_MS = 86_400_000;
const QUESTION =
  "Is today a day this routine should post (its condition holds today)? Answer no if the routine says to reply SKIP today.";

const localDate = (now: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);

export const postsToday = async (prompt: string, timeZone: string, now = new Date()) => {
  const today = dayState(localDate(now, timeZone));
  const tomorrow = dayState(
    new Date(Date.parse(today.gregorian) + DAY_MS).toISOString().slice(0, 10),
  );
  const chance = await yesChances(
    { routine: prompt, today, tomorrow },
    { post: QUESTION },
    "clef",
  ).catch((err: Error) => {
    console.warn(`routine day check failed: ${reasonOf(err)}`);
  });
  return (chance?.("post") ?? 1) >= SKIP_BELOW;
};
