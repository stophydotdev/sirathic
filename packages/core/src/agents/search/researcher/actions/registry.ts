import { tool, type ToolSet } from "ai";
import type {
  ActionEnabledConfig,
  ActionOutput,
  AdditionalConfig,
  ResearchAction,
} from "../../types";

class ActionRegistry {
  private static actions: Map<string, ResearchAction> = new Map();

  static register(action: ResearchAction<any>) {
    ActionRegistry.actions.set(action.name, action);
  }

  static get(name: string): ResearchAction | undefined {
    return ActionRegistry.actions.get(name);
  }

  static getAvailableActions(config: ActionEnabledConfig): ResearchAction[] {
    return Array.from(ActionRegistry.actions.values()).filter((action) =>
      action.enabled(config),
    );
  }

  static getAvailableActionTools(
    config: ActionEnabledConfig,
    additionalConfig: AdditionalConfig,
    onOutput: (output: ActionOutput) => void,
  ): ToolSet {
    const availableActions = ActionRegistry.getAvailableActions(config);

    return Object.fromEntries(
      availableActions.map((action) => [
        action.name,
        tool({
          description: action.getToolDescription({ mode: config.mode }),
          inputSchema: action.schema,
          execute: async (params) => {
            const output = await action.execute(params, additionalConfig);
            onOutput(output);

            if (output.type === "search_results") {
              return {
                type: "search_results",
                note: "You are seeing short excerpts only. The FULL content of every result below (complete transcripts and pages) is already captured and will be handed to the answer writer. Never re-search, re-read, or look for summaries of these — judge sufficiency by topic coverage, not excerpt length.",
                results: output.results.map((r) => ({
                  metadata: r.metadata,
                  fullContentCaptured: r.content.length > 1200,
                  excerpt: r.content.slice(0, 1200),
                })),
              };
            }

            return output;
          },
        }),
      ]),
    );
  }

  static getAvailableActionsDescriptions(config: ActionEnabledConfig): string {
    const availableActions = ActionRegistry.getAvailableActions(config);

    return availableActions
      .map(
        (action) =>
          `<tool name="${action.name}">\n${action.getDescription({ mode: config.mode })}\n</tool>`,
      )
      .join("\n\n");
  }
}

export default ActionRegistry;
