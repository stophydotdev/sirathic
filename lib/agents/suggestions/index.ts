import { generateText, LanguageModel, Output } from "ai";
import z from "zod";
import { suggestionGeneratorPrompt } from "@/lib/prompts/suggestions";
import formatChatHistoryAsString from "@/lib/utils/formatHistory";
import { ChatTurnMessage } from "@/lib/types";

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
