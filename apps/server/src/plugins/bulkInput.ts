import { z } from "zod";

export const BULK = "bulk_action";

const toolArguments = z.record(z.string(), z.unknown());

export const bulkInput = z.object({
  search: z.object({
    tool: z
      .string()
      .describe("A read-only search or list tool of one connected app, like gmail_search_threads"),
    arguments: toolArguments
      .optional()
      .describe(
        "Its arguments. The server follows its next pages and checks at most 256 items in all",
      ),
  }),
  rule: z
    .string()
    .min(3)
    .describe(
      "What to act on, as one plain sentence about the items themselves and with no exceptions, like marketing emails: promotions, sales offers and newsletters. Never write what to keep, like but keep receipts: that confuses the check. Items the user wants kept must simply not fit the sentence.",
    ),
  action: z.object({
    tool: z
      .string()
      .describe("The tool of the same app to run on every match, like gmail_trash_thread"),
    idArgument: z
      .string()
      .describe("The argument of that tool that takes an item's id, like threadId"),
    arguments: toolArguments.optional().describe("Any other fixed arguments that tool needs"),
  }),
  matches: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .optional()
    .describe("Filled in by the server. Never set it."),
  left: z.number().optional().describe("Filled in by the server. Never set it."),
});

export type BulkInput = z.infer<typeof bulkInput>;

export const bulkCall = ({ toolName, input }: { toolName: string; input: unknown }) =>
  toolName === BULK ? bulkInput.safeParse(input).data : undefined;
