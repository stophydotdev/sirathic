import { ANSWER_CARDS, todoList } from "@sirathic/server/cards";
import { type ChatMessage, currentToolName } from "@sirathic/server/messages";
import { z } from "zod";
import { siteName } from "./sources";

type Part = ChatMessage["parts"][number];

const searchInput = z
  .object({ queries: z.array(z.string()), arabic: z.array(z.string()) })
  .partial()
  .catch({});

const fetchInput = z
  .union([
    z.object({ urls: z.array(z.string()) }),
    z.object({ url: z.string() }).transform(({ url }) => ({ urls: [url] })),
  ])
  .catch({ urls: [] });

const TOOL_NAMES = new Map(
  Object.entries({
    load_skill: { now: "Loading a skill", done: "Skills" },
    update_memory: { now: "Saving to your preferences", done: "Saved to your preferences" },
    search_past_chats: { now: "Searching your past chats", done: "Searched your past chats" },
    search_user_memories: { now: "Checking your memory", done: "Checked your memory" },
    stophy_search_endpoints: { now: "Checking Stophy", done: "Read from Stophy" },
    stophy_call: { now: "Reading from Stophy", done: "Read from Stophy" },
    code_execution: { now: "Running code", done: "Ran code" },
    search_duas: { now: "Finding duas", done: "Found duas" },
  }),
);

export const toolOf = (part: Part) => {
  const output = "output" in part ? part.output : undefined;
  return part.type === "dynamic-tool"
    ? { id: part.toolCallId, name: part.toolName, input: part.input, output }
    : part.type.startsWith("tool-") && "input" in part
      ? {
          id: part.toolCallId,
          name: currentToolName(part.type.slice(5)),
          input: part.input,
          output,
        }
      : undefined;
};

export type Now = { kind: "think" | "search" | "read" | "tool"; text: string; url?: string };

const stepOf = (part: Part | undefined): Now => {
  if (!part || part.type === "reasoning") return { kind: "think", text: "Thinking" };
  const tool = toolOf(part);
  if (!tool) return { kind: "think", text: "Working" };
  if (tool.name === "search_web") {
    const { queries = [], arabic = [] } = searchInput.parse(tool.input);
    const query = [...queries, ...arabic].at(-1);
    return { kind: "search", text: query ? `Searching “${query}”` : "Searching" };
  }
  if (tool.name === "fetch_url") {
    const url = fetchInput.parse(tool.input).urls.at(-1);
    return url
      ? { kind: "read", text: `Reading ${siteName(url)}`, url }
      : { kind: "read", text: "Reading" };
  }
  return { kind: "tool", text: TOOL_NAMES.get(tool.name)?.now ?? tool.name.replaceAll("_", " ") };
};

export const stepsOf = (message: ChatMessage): Now[] => {
  const steps = message.parts.filter(
    (part) => part.type === "reasoning" || toolOf(part) !== undefined,
  );
  const tools = steps.filter((part) => {
    const tool = toolOf(part);
    return tool !== undefined && !ANSWER_CARDS.some((card) => card === tool.name);
  });
  const current = steps.at(-1);
  const thinking = current === undefined || current.type === "reasoning" || tools.length === 0;
  return [...tools.map(stepOf), ...(thinking ? [stepOf(undefined)] : [])];
};

export function summaryOf(message: ChatMessage) {
  const tools = message.parts.flatMap((part) => toolOf(part) ?? []);
  const searches = tools
    .filter((tool) => tool.name === "search_web")
    .reduce((count, tool) => {
      const { queries = [], arabic = [] } = searchInput.parse(tool.input);
      return count + queries.length + arabic.length;
    }, 0);
  const pages = tools
    .filter((tool) => tool.name === "fetch_url")
    .reduce((count, tool) => count + fetchInput.parse(tool.input).urls.length, 0);
  const used = new Set(
    tools
      .filter(
        (tool) =>
          tool.name !== "search_web" &&
          tool.name !== "fetch_url" &&
          !ANSWER_CARDS.some((card) => card === tool.name),
      )
      .map((tool) => TOOL_NAMES.get(tool.name)?.done ?? `Used ${tool.name.replaceAll("_", " ")}`),
  );
  return [
    ...(searches > 0 ? [searches === 1 ? "Ran 1 search" : `Ran ${searches} searches`] : []),
    ...(pages > 0 ? [pages === 1 ? "Browsed 1 page" : `Browsed ${pages} pages`] : []),
    ...used,
  ];
}

export const latestTodoId = (messages: readonly ChatMessage[]) =>
  messages
    .flatMap((message) => message.parts.flatMap((part) => toolOf(part) ?? []))
    .findLast((tool) => tool.name === "todo_write" && todoList.safeParse(tool.output).success)?.id;
