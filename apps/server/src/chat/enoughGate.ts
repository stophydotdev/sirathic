import { z } from "zod";
import { yesChances } from "./clef";

const RESEARCH_TOOLS = new Set([
  "search_web",
  "fetch_url",
  "get_verses",
  "search_images",
  "search_x",
  "stophy_search_endpoints",
  "stophy_call",
  "shop_search",
  "prayer_times",
  "islamic_dates",
]);
const ENOUGH = 0.6;
const FOUND_CHARS = 12_000;
const readText = z
  .union([
    z.object({ text: z.string() }).transform(({ text }) => text),
    z.object({ pages: z.array(z.looseObject({})) }).transform(({ pages }) => JSON.stringify(pages)),
  ])
  .catch(({ input }) => JSON.stringify(input));

export const ENOUGH_STEP =
  "You have found enough. Answer now from what you found, and say what you could not check.";

export const researchedEnough = async (
  asked: string,
  steps: readonly {
    toolCalls: readonly { toolName: string }[];
    toolResults: readonly { output: unknown }[];
  }[],
) => {
  const calls = steps.at(-1)?.toolCalls ?? [];
  if (calls.length === 0 || !calls.every(({ toolName }) => RESEARCH_TOOLS.has(toolName))) {
    return false;
  }
  const latest = steps.at(-1)?.toolResults ?? [];
  if (latest.length > 0 && latest.every(({ output }) => readText.parse(output).trim() === "")) {
    return false;
  }
  const found = steps
    .flatMap((step) => step.toolResults.map(({ output }) => readText.parse(output)))
    .join("\n")
    .slice(-FOUND_CHARS);
  try {
    const chance = await yesChances(
      { question: asked, found },
      {
        enough:
          "Do the results found so far already hold what is needed to answer the question well, with a source for each key claim? Answer no if any part of the question is still unanswered.",
      },
    );
    return (chance("enough") ?? 0) >= ENOUGH;
  } catch {
    return false;
  }
};
