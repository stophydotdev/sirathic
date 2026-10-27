import { tool } from "ai";
import { z } from "zod";
import { automationInput, createAutomation, listAutomations } from "./store";

const createInput = automationInput.pick({ name: true, prompt: true, schedule: true });

export type AutomationScope = { owner: string; timezone: string; projectId?: string };

export function automationTools({ owner, timezone, projectId }: AutomationScope) {
  return {
    createAutomation: tool({
      description: `Creates a scheduled automation: Noor answers the prompt on its own at the scheduled times and saves each answer as a chat. Use it only when the user tells you to create a reminder, routine or scheduled answer in their own words, such as "every Friday morning remind me to read Surah al-Kahf" or "set up a daily hadith at 7". A wish or a job that mentions how often, like "teach me one hadith a day", is not a request to create one: answer it and create nothing. The user's time zone is ${timezone} and all times are 24-hour clock times in it. Weekly days are numbers, 0 is Sunday and 6 is Saturday. Pick a sensible time when the user gives only a part of the day (morning 08:00, evening 18:00) and say which time you chose. Use "once" only with a future date. Write the prompt as the instruction Noor will receive each run, with no mention of the schedule. Reply with one short sentence after it succeeds, since the user sees a card with the name and schedule.`,
      inputSchema: createInput,
      execute: (input) => createAutomation(owner, { ...input, timezone, projectId }),
    }),
    listAutomations: tool({
      description:
        "Lists the user's automations with their schedule and whether they are paused. Use it when they ask what automations or reminders they have. The user sees the list, so answer in one short sentence.",
      inputSchema: z.object({}),
      execute: () => listAutomations(owner),
    }),
  };
}
