import { generateText, Output } from "ai";
import z from "zod";
import { classifierPrompt } from "@/lib/prompts/search/classifier";
import formatChatHistoryAsString from "@/lib/utils/formatHistory";
import { ClassifierInput } from "./types";

const schema = z.object({
  classification: z.object({
    skipSearch: z
      .boolean()
      .describe("Indicates whether to skip the search step."),
    quranSearch: z
      .boolean()
      .describe("Indicates whether to search the Quran."),
    hadithSearch: z
      .boolean()
      .describe("Indicates whether to search hadith collections."),
    fiqhSearch: z
      .boolean()
      .describe(
        "Indicates whether to search fatwa and scholarly rulings sources.",
      ),
    haramAssistance: z
      .boolean()
      .describe(
        "Indicates the query seeks active assistance with something impermissible in Islam.",
      ),
  }),
  standaloneFollowUp: z
    .string()
    .describe(
      "A self-contained, context-independent reformulation of the user's question.",
    ),
});

type ClassifierOutput = z.infer<typeof schema>;

export const classify = async (
  input: ClassifierInput,
): Promise<ClassifierOutput> => {
  const { output } = await generateText({
    model: input.llm,
    instructions: classifierPrompt,
    prompt: `<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_query>\n${input.query}\n</user_query>`,
    output: Output.object({ schema }),
  });

  return output;
};

export type { ClassifierOutput };
