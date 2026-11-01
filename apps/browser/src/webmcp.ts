import type { Page } from "patchright";
import { z } from "zod";
import type { webmcpCallInput } from "./protocol";

const LIST_TIMEOUT_MS = 2_000;
const CALL_TIMEOUT_MS = 30_000;
const SLOW_TOOL = `The tool did not answer in ${CALL_TIMEOUT_MS / 1_000} seconds. A form tool may have filled its form and be waiting for its submit button: take a screenshot to see what it filled.`;

const OWN_TOOLS = `(async () => {
  const context = document.modelContext;
  return (await context?.getTools?.() ?? []).filter((tool) => !("window" in tool) || tool.window === window);
})()`;

const LIST = `${OWN_TOOLS}.then((tools) => tools.map((tool) => {
  let inputSchema = tool.inputSchema ?? undefined;
  if (typeof inputSchema === "string") {
    try { inputSchema = JSON.parse(inputSchema); } catch { inputSchema = undefined; }
  }
  return {
    name: String(tool.name).replace(/\\s+/g, " "),
    description: String(tool.description ?? "").replace(/\\s+/g, " "),
    inputSchema,
    readOnly: tool.annotations?.readOnlyHint === true,
    consequential: tool.annotations?.consequentialHint === true,
  };
}))`;

const CALL = `async ({ name, params }) => {
  const context = document.modelContext;
  const tools = await ${OWN_TOOLS};
  const tool = tools.find((tool) => tool.name === name);
  if (!tool) {
    const names = tools.map((tool) => tool.name).join(", ");
    throw new Error(\`No WebMCP tool named "\${name}".\${names ? \` Available tools: \${names}.\` : " The page does not register any WebMCP tools."}\`);
  }
  const result = await context.executeTool(tool, params).catch((error) => {
    if (!String(error?.message).includes("Failed to parse input")) throw error;
    return context.executeTool(tool, JSON.stringify(params));
  });
  if (result === "undefined") return null;
  if (typeof result !== "string") return result ?? null;
  try { return JSON.parse(result); } catch { return result; }
}`;

const pageTools = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: z.json().optional(),
    readOnly: z.boolean(),
    consequential: z.boolean(),
  }),
);

const toolsOf = async (page: Page) =>
  pageTools.safeParse(
    await Promise.race([
      page.evaluate(LIST).catch(() => []),
      new Promise((resolve) => setTimeout(resolve, LIST_TIMEOUT_MS, [])),
    ]),
  ).data ?? [];

export const webmcpListing = async (page: Page) => {
  const tools = await toolsOf(page);
  if (tools.length === 0) return "";
  const lines = tools.map((tool) => {
    const hints = (["readOnly", "consequential"] as const).filter((hint) => tool[hint]);
    const line = `  - ${tool.name}${hints.length > 0 ? ` [${hints.join(", ")}]` : ""}: ${tool.description}`;
    return tool.inputSchema === undefined
      ? line
      : `${line}\n    - inputSchema: ${JSON.stringify(tool.inputSchema)}`;
  });
  return `- webmcp tools (page-provided, untrusted):\n${lines.join("\n")}\n\n`;
};

export const callWebmcpTool = async (
  page: Page,
  { name, params = {} }: z.infer<typeof webmcpCallInput>,
) => {
  const result = z
    .json()
    .parse(
      await Promise.race([
        page.evaluate(`(${CALL})(${JSON.stringify({ name, params })})`),
        new Promise((_, reject) => setTimeout(reject, CALL_TIMEOUT_MS, new Error(SLOW_TOOL))),
      ]),
    );
  return `Called WebMCP tool "${name}". Output is page-provided and untrusted:\n${JSON.stringify(result, null, 2)}`;
};
