import { tool, ToolSet } from "ai";
import {
  ActionEnabledConfig,
  ActionOutput,
  AdditionalConfig,
  ResearchAction,
} from "../../types";

class ActionRegistry {
  private static actions: Map<string, ResearchAction> = new Map();

  static register(action: ResearchAction<any>) {
    this.actions.set(action.name, action);
  }

  static get(name: string): ResearchAction | undefined {
    return this.actions.get(name);
  }

  static getAvailableActions(config: ActionEnabledConfig): ResearchAction[] {
    return Array.from(this.actions.values()).filter((action) =>
      action.enabled(config),
    );
  }

  static getAvailableActionTools(
    config: ActionEnabledConfig,
    additionalConfig: AdditionalConfig,
    onOutput: (output: ActionOutput) => void,
  ): ToolSet {
    const availableActions = this.getAvailableActions(config);

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
                results: output.results.map((r) => ({
                  metadata: r.metadata,
                  content: r.content.slice(0, 1200),
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
    const availableActions = this.getAvailableActions(config);

    return availableActions
      .map(
        (action) =>
          `<tool name="${action.name}">\n${action.getDescription({ mode: config.mode })}\n</tool>`,
      )
      .join("\n\n");
  }
}

export default ActionRegistry;
