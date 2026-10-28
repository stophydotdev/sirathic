import type { ToolSet } from "ai";
import { z } from "zod";

export const CONFIRM_RULES = `A plugin call that sends, posts, shares, pays or deletes shows the user a card to confirm; other calls run at once. Name exactly who or what it affects, never ask for confirmation in text, and don't repeat a cancelled call.`;

const readOnlyTool = z.object({ annotations: z.object({ readOnlyHint: z.literal(true) }) });

export const writingTools = (tools: ToolSet) =>
  Object.entries(tools).flatMap(([name, entry]) =>
    readOnlyTool.safeParse(entry.metadata).success ? [] : [name],
  );

const CONFIRMED_ACTIONS = new Map<string, readonly string[]>([["update_skill", ["delete"]]]);

const SENSITIVE =
  /(?:^|[^a-z])(?:delete|remove|destroy|drop|truncate|purge|erase|send|post|publish|reply|forward|invite|share|pay|charge|refund|transfer|payout|cancel)(?=$|[^a-z])/iu;

const spelledOut = z
  .object({
    action: z.string().catch(""),
    command: z.string().catch(""),
    sql: z.string().catch(""),
    sql_statements: z.array(z.string()).catch([]),
  })
  .catch({ action: "", command: "", sql: "", sql_statements: [] });

export const needsApproval = (
  { toolName, input }: { toolName: string; input: unknown },
  writes: ReadonlySet<string>,
) => {
  const { action, command, sql, sql_statements } = spelledOut.parse(input);
  const spelled = [toolName, action, command, sql, ...sql_statements]
    .join(" ")
    .replaceAll(/(\p{Ll})(\p{Lu})/gu, "$1 $2");
  return (
    (writes.has(toolName) && SENSITIVE.test(spelled)) ||
    (CONFIRMED_ACTIONS.get(toolName)?.includes(action) ?? false)
  );
};
