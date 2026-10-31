import type { CallToolResult } from "@ai-sdk/mcp";
import { type Tool, tool } from "ai";
import { z } from "zod";
import { yesChances } from "../chat/clef";
import { actionOf, isReadOnly } from "../chat/confirm";
import { BULK, type BulkInput, bulkInput } from "./bulkInput";

const CLEF_QUESTIONS = 64;
const MAX_ITEMS = 256;
const MATCH_AT = 0.6;
const WRITES_AT_ONCE = 4;
const MAX_FAILURES_SHOWN = 20;
const FACTS_CHARS = 500;
const LABEL_CHARS = 120;
const LABEL_KEYS = new Set(["subject", "title", "name", "sender", "from", "snippet", "summary"]);
const NOISE = /url|link/iu;

type Args = NonNullable<BulkInput["search"]["arguments"]>;

type Tools = Readonly<Record<string, Tool<unknown, CallToolResult>>>;

const toolResult = z.object({
  content: z.array(z.looseObject({ text: z.string().optional() })),
  structuredContent: z.record(z.string(), z.unknown()).optional(),
  isError: z.boolean().optional(),
});

const row = z.looseObject({ id: z.string() });

type Row = z.infer<typeof row>;

const FOLLOWING = /^next(?<argument>\w*(?:token|cursor))$/iu;

const pageOf = z.union([
  z.array(row).transform((rows) => ({ rows, following: undefined })),
  z.record(z.string(), z.unknown()).transform((found) => {
    const rows = Object.values(found).flatMap((value) => {
      const listed = z.array(row).safeParse(value);
      return listed.success ? [listed.data] : [];
    })[0];
    const following = Object.entries(found).flatMap(([key, value]) => {
      const argument = FOLLOWING.exec(key)?.groups?.argument;
      const token = z.string().min(1).safeParse(value).data;
      return argument && token
        ? [{ argument: argument.charAt(0).toLowerCase() + argument.slice(1), token }]
        : [];
    })[0];
    return { rows: rows ?? [], following };
  }),
]);

const call = async (tools: Tools, name: string, args: Args) => {
  const entry = tools[name];
  if (!entry?.execute) throw new Error(`${name} is not a tool of a connected app`);
  const result = toolResult.parse(
    await entry.execute(args, { toolCallId: name, messages: [], context: undefined }),
  );
  const text = result.content.map(({ text: part }) => part ?? "").join("");
  if (result.isError) throw new Error(text.slice(0, LABEL_CHARS));
  return { text, structured: result.structuredContent };
};

const factsOf = (item: Row) =>
  JSON.stringify(item, (key, value) => (NOISE.test(key) ? undefined : value)).slice(0, FACTS_CHARS);

const labelOf = (item: Row) => {
  const found: string[] = [];
  JSON.stringify(item, (key, value) => {
    const text = LABEL_KEYS.has(key) ? z.string().safeParse(value).data : undefined;
    if (text) found.push(text);
    return value;
  });
  return [...new Set(found)].join(" | ").slice(0, LABEL_CHARS) || item.id;
};

const chancesFor = async (rule: string, items: readonly Row[]) => {
  const batches = Array.from({ length: Math.ceil(items.length / CLEF_QUESTIONS) }, (_, index) =>
    items.slice(index * CLEF_QUESTIONS, (index + 1) * CLEF_QUESTIONS),
  );
  const asked = await Promise.all(
    batches.map(async (batch) => {
      const chance = await yesChances(
        {
          rule,
          items: Object.fromEntries(batch.map((item, index) => [`i${index}`, factsOf(item)])),
        },
        Object.fromEntries(
          batch.map((_, index) => [`i${index}`, `Does item i${index} match the rule?`]),
        ),
        "clef",
      );
      return batch.map((_, index) => chance(`i${index}`) ?? 0);
    }),
  );
  return asked.flat();
};

const listed = async (
  tools: Tools,
  search: BulkInput["search"],
  found: readonly Row[] = [],
): Promise<readonly Row[]> => {
  const { text, structured } = await call(tools, search.tool, search.arguments ?? {});
  const { rows, following } = pageOf.parse(structured ?? JSON.parse(text));
  const items = [...found, ...rows].slice(0, MAX_ITEMS);
  return following && rows.length > 0 && items.length < MAX_ITEMS
    ? listed(
        tools,
        { ...search, arguments: { ...search.arguments, [following.argument]: following.token } },
        items,
      )
    : items;
};

const checkedAction = (tools: Tools, action: BulkInput["action"]) => {
  const writer = tools[action.tool];
  if (!writer || isReadOnly(writer) || action.tool === BULK) {
    throw new Error(`${action.tool} is not a write tool of a connected app`);
  }
  for (const input of [{}, action.arguments ?? {}]) {
    const kind = actionOf({ toolName: action.tool, input });
    if (kind !== undefined && kind !== "delete" && kind !== "cancel") {
      throw new Error(`Bulk actions never ${kind}. Do those one at a time.`);
    }
  }
};

const planOf = async (tools: Tools, { search, action, rule }: BulkInput) => {
  const finder = tools[search.tool];
  if (!finder || !isReadOnly(finder)) {
    throw new Error(`${search.tool} is not a read-only search tool of a connected app`);
  }
  checkedAction(tools, action);
  const items = await listed(tools, search);
  const chances = await chancesFor(rule, items);
  const matches = items.flatMap((item, index) =>
    (chances[index] ?? 0) >= MATCH_AT ? [{ id: item.id, label: labelOf(item) }] : [],
  );
  return { matches, left: items.length - matches.length };
};

export const bulkTools = (tools: Tools) => ({
  tools: {
    [BULK]: tool({
      description:
        "Apply one action to every item of a connected app that matches a rule, like trashing every promotion in Gmail. Use it instead of repeating the same write tool, whenever more than a few items are involved. You give a search tool call, the rule in the user's words and the write tool with the argument that takes an item's id. The server fetches the items, checks each one against the rule, shows the user one card listing what will change and runs the action on the approved items. You never see the items and never call the write tool per item. It returns the counts and any item that failed. It follows the search's next pages itself, so call it once, not once per page, and call it again only if checked is 256 and the user wants more.",
      inputSchema: bulkInput,
      execute: async ({ matches, left, action }, { abortSignal }) => {
        if (!matches) throw new Error("The items were not checked. Nothing changed.");
        checkedAction(tools, action);
        const failed: { id: string; label: string; error: string }[] = [];
        let changed = 0;
        const lanes = Array.from({ length: WRITES_AT_ONCE }, (_, lane) =>
          matches.filter((_match, index) => index % WRITES_AT_ONCE === lane),
        );
        await Promise.all(
          lanes.map((lane) =>
            lane.reduce(async (previous, next) => {
              await previous;
              if (abortSignal?.aborted) return;
              try {
                await call(tools, action.tool, {
                  ...action.arguments,
                  [action.idArgument]: next.id,
                });
                changed += 1;
              } catch (err) {
                failed.push({
                  ...next,
                  error: (err instanceof Error ? err.message : String(err)).slice(0, LABEL_CHARS),
                });
              }
            }, Promise.resolve()),
          ),
        );
        return {
          action: action.tool,
          checked: matches.length + (left ?? 0),
          changed,
          leftAlone: left,
          failedCount: failed.length,
          failed: failed.slice(0, MAX_FAILURES_SHOWN),
        };
      },
    }),
  },
  refine: {
    [BULK]: async (asked: BulkInput) =>
      asked.matches ? asked : { ...asked, ...(await planOf(tools, asked)) },
  },
});
