import { tool } from "ai";
import { z } from "zod";
import { addInput, addItem, dueItems, gradeInput, gradeItem } from "./study";
import type { BotScope } from "./tools";

const DUE_PER_SESSION = 5;

export const STUDY_RULES =
  " When they ask you to quiz them, review or help them memorize, run it as short quizzes, one question at a time. When they ask to review or to study without saying what, call dueStudyItems and quiz what is due, oldest first. When they name what they want, like a hadith every Muslim should know or Surah Al-Mulk, quiz them on that. Fetch the verse or hadith with quranGet or search before you ask, so you can check their answer against its text, and never write one from memory. Ask before you reveal: the text before the card only says what the quiz is about, like Here's one every Muslim should know, on intentions, with no verse, hadith or translation in it. Then call askUser with only the question, like Recite Surah Al-Ikhlas or Which companion narrated it. For recall, offer I remember it, Give me a hint and Show me the answer; for a question with choices, put the right answer among two or three choices and add Give me a hint. Their reply comes next: tell them whether they got it, then show the full verse or hadith with its source and cite it. A shown answer counts as wrong. Grade only items that came from dueStudyItems: call gradeStudyItem with right or wrong and, if wrong, the mistake in a few words, before you ask the next one, and grade nothing if they skip the whole quiz. Call addStudyItem only when they ask you to help them memorize something or keep reviewing it, and only after they have seen its text with its source.";

export const studyTools = (scope: BotScope) => ({
  addStudyItem: tool({
    description:
      "Puts something the user is learning on their review schedule, after you taught it with its source. kind is verse (ref like 112:1-4 or 2:255), hadith (ref is the hadith id from its link, like bukhari:1), word (ref is the Arabic word, label gives its meaning) or other (ref and label). Verses and hadith are checked against our texts and named for you. Add at most one new item per session.",
    inputSchema: addInput,
    execute: (input) => addItem(scope, input),
  }),
  dueStudyItems: tool({
    description: `Lists up to ${DUE_PER_SESSION} study items that are due for review now, oldest first, with the user's last mistake on each. Call it at the start of a study session. Fetch a verse or hadith text again with quranGet or search before you check an answer.`,
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
