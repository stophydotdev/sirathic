import type { ToolSet } from "ai";
import { z } from "zod";

export const CONFIRM_RULES = `Some plugin tools change things outside Sirathic, like sending, posting or creating. Before you call one, look up anything unclear with the plugin's read tools, such as which person, channel or file, so the call names it exactly. Then call it. The user sees the exact call as a card and confirms or cancels it; never ask for confirmation in text. Do not change the call after they confirm it. If they cancel, don't call it again unless they ask.`;

const readOnlyTool = z.object({ annotations: z.object({ readOnlyHint: z.literal(true) }) });

export const writingTools = (tools: ToolSet) =>
  Object.entries(tools).flatMap(([name, entry]) =>
    readOnlyTool.safeParse(entry.metadata).success ? [] : [name],
  );

const CONFIRMED_TOOLS: ReadonlySet<string> = new Set(["install_plugin"]);

const CONFIRMED_ACTIONS = new Map<string, readonly string[]>([
  ["update_routine", ["create", "edit", "delete"]],
  ["update_skill", ["delete"]],
]);

const actionOf = z.object({ action: z.string() });

export const needsApproval = (
  { toolName, input }: { toolName: string; input: unknown },
  writes: ReadonlySet<string>,
) =>
  writes.has(toolName) ||
  CONFIRMED_TOOLS.has(toolName) ||
  (CONFIRMED_ACTIONS.get(toolName)?.includes(actionOf.safeParse(input).data?.action ?? "") ??
    false);
