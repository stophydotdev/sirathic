import { tool } from "ai";
import { z } from "zod";
import { addInput, addItem, dueItems, gradeInput, gradeItem } from "./study";
import type { BotScope } from "./tools";

const DUE_PER_SESSION = 5;

export const studyTools = (scope: BotScope) => ({
  addStudyItem: tool({
    description:
      "Puts something the user is learning on their review schedule, after you taught it with its source. kind is verse (ref like 112:1-4 or 2:255), hadith (ref is the hadith id from its link, like bukhari:1), word (ref is the Arabic word, label gives its meaning) or other (ref and label). Verses and hadith are checked against our texts and named for you. Add a hadith only when your sources grade it sahih or hasan. Add at most one new item per session.",
    inputSchema: addInput,
    execute: (input) => addItem(scope, input),
  }),
  dueStudyItems: tool({
    description: `Lists up to ${DUE_PER_SESSION} study items that are due for review now, oldest first, with the user's last mistake on each. Call it at the start of a study session. Fetch a verse or hadith text again with get_verses or search_web before you check an answer.`,
    inputSchema: z.object({}),
    execute: async () => ({ due: await dueItems(scope, DUE_PER_SESSION) }),
  }),
  gradeStudyItem: tool({
    description:
      "Records how a review went. right moves the item up the schedule, wrong sends it back to the start and keeps the mistake in a few words. Call it once their reply to your quiz comes in and before you ask the next one. A shown answer is wrong. It returns when the item is next due: tell them that, not that it stays due. Never grade an item you did not ask about.",
    inputSchema: gradeInput,
    execute: (input) => gradeItem(scope, input),
  }),
});
