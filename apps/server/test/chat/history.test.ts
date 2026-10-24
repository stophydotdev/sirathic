import { expect, test } from "bun:test";
import { convertToModelMessages } from "ai";
import type { ChatMessage } from "../../src/shared/messages";
import { citations } from "../../src/chat/citations";
import { shortenEarlierResults } from "../../src/chat/history";

const searched = (toolCallId: string): ChatMessage["parts"][number] => ({
  type: "tool-search",
  toolCallId,
  state: "output-available",
  input: { queries: ["what breaks wudu"], sources: ["fatwa"] },
  output: {
    results: {},
    sources: [
      {
        url: "https://islamqa.info/en/answers/14321",
        title: "Wudu",
        snippet: "",
      },
      { url: "https://example.com/uncited", title: "Uncited", snippet: "" },
    ],
    text: "",
  },
});

const history: ChatMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "what breaks wudu" }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      searched("call-1"),
      {
        type: "text",
        text: "Deep sleep breaks wudu.[4](https://islamqa.info/en/answers/14321)",
      },
    ],
  },
  { id: "u2", role: "user", parts: [{ type: "text", text: "and bleeding?" }] },
  { id: "a2", role: "assistant", parts: [searched("call-2")] },
];

const sentOutputs = async (toolCallId: string) => {
  const shorten = shortenEarlierResults(history, citations(history).numberOf);
  return (await convertToModelMessages(history))
    .map(shorten)
    .flatMap((message) => (message.role === "tool" ? message.content : []))
    .flatMap((part) =>
      part.type === "tool-result" && part.toolCallId === toolCallId ? [part.output] : [],
    );
};

test("an earlier turn's results reach the model as the sources its answer cited", async () => {
  expect(await sentOutputs("call-1")).toEqual([
    {
      type: "text",
      value:
        "Earlier results, removed to save space. Cited in the answer: [4] Wudu. Search again if you need their full text.",
    },
  ]);
});

test("results after the last question reach the model in full", async () => {
  expect((await sentOutputs("call-2"))[0]).toEqual({
    type: "json",
    value: {
      results: {},
      sources: [
        {
          url: "https://islamqa.info/en/answers/14321",
          title: "Wudu",
          snippet: "",
        },
        { url: "https://example.com/uncited", title: "Uncited", snippet: "" },
      ],
      text: "",
    },
  });
});
