import type { ChatTurnMessage } from "@sirathic/core/types";

export const videoSearchPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question so it is a standalone query that can be used to search YouTube for videos.
You need to make sure the rephrased query agrees with the conversation and is relevant to the conversation.
Make sure the query is standalone and not something very broad, use context from the answers in the conversation to make it specific so the user gets the best video search results.
For religious topics, favor queries that surface lectures, khutbahs, tafsir, and recitations from reputable speakers.
Output only the rephrased query in the query key JSON format. Do not include any explanation or additional text.
`;

export const videoSearchFewShots: ChatTurnMessage[] = [
  {
    role: "user",
    content:
      "<conversation>\n</conversation>\n<follow_up>\nHow does a car work?\n</follow_up>",
  },
  { role: "assistant", content: '{"query":"How does a car work"}' },
  {
    role: "user",
    content:
      "<conversation>\n</conversation>\n<follow_up>\nWhat is the theory of relativity?\n</follow_up>",
  },
  { role: "assistant", content: '{"query":"Theory of relativity explained"}' },
  {
    role: "user",
    content:
      "<conversation>\nUser: What does the Quran say about patience?\nAI: The Quran repeatedly commands patience (sabr)...\n</conversation>\n<follow_up>\nAny good lectures on this?\n</follow_up>",
  },
  {
    role: "assistant",
    content: '{"query":"lecture on patience sabr in Islam"}',
  },
];
