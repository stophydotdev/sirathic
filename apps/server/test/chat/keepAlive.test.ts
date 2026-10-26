import { expect, test } from "bun:test";
import { keepAlive } from "../../src/chat/keepAlive";

test("keepAlive pings while the stream is quiet and passes the data through", async () => {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const source = writable.getWriter();
  const piped = readable.pipeThrough(keepAlive(20));
  const reader = piped.getReader();

  expect(new TextDecoder().decode((await reader.read()).value)).toBe(": ping\n\n");

  reader.releaseLock();
  await source.write(new TextEncoder().encode("data: {}\n\n"));
  await source.close();
  const rest = await Array.fromAsync(piped);
  expect(new TextDecoder().decode(rest.at(-1))).toBe("data: {}\n\n");
});
