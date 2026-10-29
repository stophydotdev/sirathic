import { expect, test } from "bun:test";
import { SpanStatusCode } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import { simulateReadableStream } from "ai";
import {
  followAnswer,
  isAnswering,
  startAnswer,
  stopAnswer,
} from "../apps/server/src/chat/answers";
import server from "../apps/server/src/index";
import { withoutErrorText } from "../apps/server/src/tracing";

test("an answer runs until stopped or replaced, not until the browser leaves", async () => {
  const first = startAnswer("user", "chat");
  expect(isAnswering("user", "chat")).toBe(true);
  const second = startAnswer("user", "chat");
  expect(first.signal.aborted).toBe(true);
  await first.consumeSseStream({ stream: simulateReadableStream({ chunks: [] }) });
  expect(isAnswering("user", "chat")).toBe(true);
  stopAnswer("other", "chat");
  expect(second.signal.aborted).toBe(false);
  stopAnswer("user", "chat");
  expect(second.signal.aborted).toBe(true);
  await second.consumeSseStream({ stream: simulateReadableStream({ chunks: [] }) });
  expect(isAnswering("user", "chat")).toBe(false);
});

test("a chat opened mid-answer gets what was sent so far, then the rest live", async () => {
  const answer = startAnswer("user", "chat");
  const { readable, writable } = new TransformStream<string, string>();
  const done = answer.consumeSseStream({ stream: readable });
  const source = writable.getWriter();
  await source.write("data: one\n\n");
  await Bun.sleep(0);
  const following = followAnswer("user", "chat");
  await source.write("data: two\n\n");
  await source.close();
  await done;
  expect(await Array.fromAsync(following ?? [])).toEqual(["data: one\n\n", "data: two\n\n"]);
  expect(followAnswer("user", "chat")).toBeUndefined();
});

test("an answer continued after an approval is not replayed, since its stream starts mid-message", async () => {
  const answer = startAnswer("user", "chat", { continuing: true });
  expect(followAnswer("user", "chat")).toBeUndefined();
  await answer.consumeSseStream({ stream: simulateReadableStream({ chunks: [] }) });
});

test("an answer is unwatched only when its asker left and nobody follows it", async () => {
  const answer = startAnswer("user", "chat");
  const toAsker = answer.toAsker(simulateReadableStream({ chunks: [new Uint8Array([1])] }));
  expect(answer.unwatched()).toBe(false);
  const following = followAnswer("user", "chat");
  await toAsker.cancel();
  expect(answer.unwatched()).toBe(false);
  await following?.cancel();
  expect(answer.unwatched()).toBe(true);
  await answer.consumeSseStream({ stream: simulateReadableStream({ chunks: [] }) });
});

test("reopening a chat signed out gets nothing to follow, even mid-answer", async () => {
  startAnswer("user", "chat");
  const res = await server.fetch(new Request("http://localhost/api/chat/chat/stream"));
  expect(res.status).toBe(204);
  stopAnswer("user", "chat");
});

test("traces drop error text, which can hold a fetched URL", async () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [withoutErrorText, new SimpleSpanProcessor({ exporter })],
  });
  const span = provider.getTracer("test").startSpan("execute_tool fetch_url");
  const failed = new Error("Fetching https://example.com/?q=private failed");
  span.recordException(failed);
  span.setStatus({ code: SpanStatusCode.ERROR, message: failed.message });
  span.end();
  const [sent] = exporter.getFinishedSpans();
  expect(sent?.status).toEqual({ code: SpanStatusCode.ERROR });
  expect(JSON.stringify(sent?.events)).not.toContain("private");
});
