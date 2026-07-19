import { generateText, hasToolCall, isStepCount } from "ai";
import { getResearcherPrompt } from "@/lib/prompts/search/researcher";
import formatChatHistoryAsString from "@/lib/utils/formatHistory";
import { ActionOutput, ResearcherInput, ResearcherOutput } from "../types";
import { ActionRegistry } from "./actions";

class Researcher {
  async research(input: ResearcherInput): Promise<ResearcherOutput> {
    const actionOutput: ActionOutput[] = [];

    const maxIteration =
      input.config.mode === "speed"
        ? 2
        : input.config.mode === "balanced"
          ? 6
          : 25;

    const enabledConfig = {
      classification: input.classification,
      mode: input.config.mode,
    };

    const availableTools = ActionRegistry.getAvailableActionTools(
      enabledConfig,
      {
        llm: input.config.llm,
        mode: input.config.mode,
        emitSubStep: (subStep) => input.onSubStep?.(subStep),
      },
      (output) => actionOutput.push(output),
    );

    const availableActionsDescription =
      ActionRegistry.getAvailableActionsDescriptions(enabledConfig);

    await generateText({
      model: input.config.llm,
      tools: availableTools,
      stopWhen: [isStepCount(maxIteration), hasToolCall("done")],
      prepareStep: ({ stepNumber }) => ({
        instructions: getResearcherPrompt(
          availableActionsDescription,
          input.config.mode,
          stepNumber,
          maxIteration,
        ),
      }),
      prompt: `
          <conversation>
          ${formatChatHistoryAsString(input.chatHistory.slice(-10))}
           User: ${input.followUp} (Standalone question: ${input.classification.standaloneFollowUp})
           </conversation>
        `,
    });

    const searchResults = actionOutput
      .filter((a) => a.type === "search_results")
      .flatMap((a) => a.results);

    const seenUrls = new Map<string, number>();

    const filteredSearchResults = searchResults
      .map((result, index) => {
        if (result.metadata.url && !seenUrls.has(result.metadata.url)) {
          seenUrls.set(result.metadata.url, index);
          return result;
        } else if (result.metadata.url && seenUrls.has(result.metadata.url)) {
          const existingIndex = seenUrls.get(result.metadata.url)!;

          const existingResult = searchResults[existingIndex];

          existingResult.content += `\n\n${result.content}`;

          return undefined;
        }

        return result;
      })
      .filter((r) => r !== undefined);

    return {
      findings: actionOutput,
      searchFindings: filteredSearchResults.slice(0, 25),
    };
  }
}

export default Researcher;
