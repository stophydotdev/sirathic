import type { SpanProcessor } from "@opentelemetry/sdk-trace";

export const withoutErrorText = {
  onStart: () => undefined,
  onEnding: (span) => {
    const kept = span.events.filter((event) => event.name !== "exception");
    span.events.splice(0, span.events.length, ...kept);
    if (span.status.message !== undefined) span.setStatus({ code: span.status.code });
  },
  onEnd: () => undefined,
  forceFlush: () => Promise.resolve(),
  shutdown: () => Promise.resolve(),
} satisfies SpanProcessor;
