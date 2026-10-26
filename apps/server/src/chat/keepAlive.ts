const PING = new TextEncoder().encode(": ping\n\n");

export const keepAlive = (everyMs: number) => {
  let timer: ReturnType<typeof setInterval> | undefined;
  return new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      timer = setInterval(() => {
        try {
          controller.enqueue(PING);
        } catch {
          clearInterval(timer);
        }
      }, everyMs);
    },
    flush() {
      clearInterval(timer);
    },
  });
};
