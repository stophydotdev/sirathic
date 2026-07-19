import { generateText, type LanguageModel, Output } from "ai";
import z from "zod";
import { suggestionGeneratorPrompt } from "@sirathic/core/prompts/suggestions";
import formatChatHistoryAsString from "@sirathic/core/utils/formatHistory";
import type { ChatTurnMessage } from "@sirathic/core/types";

type SuggestionGeneratorInput = {
  chatHistory: ChatTurnMessage[];
};

const schema = z.object({
  suggestions: z
    .array(z.string())
    .describe("List of suggested questions or prompts"),
});

const generateSuggestions = async (
  input: SuggestionGeneratorInput,
  llm: LanguageModel,
) => {
  const { output } = await generateText({
    model: llm,
    instructions: suggestionGeneratorPrompt,
    prompt: `<chat_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</chat_history>`,
    output: Output.object({ schema }),
  });

  return output.suggestions;
};

export default generateSuggestions;
