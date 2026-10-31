import type { LanguageModelMiddleware } from "ai";
import { z } from "zod";

const NUDGE =
  "You stopped without saying anything. Continue the user's task from where you stopped if you can; otherwise tell them in one or two sentences where things stand.";

const SAYS = new Set(["tool-call", "tool-input-start", "file"]);

const connectCard = z.object({
  output: z.object({ value: z.object({ status: z.literal("redirect") }) }),
});

const sum = (a: number | undefined, b: number | undefined) =>
  a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);

export const noSilentStop: LanguageModelMiddleware = {
  wrapStream: async ({ doStream, params, model }) => {
    const first = await doStream();
    const last = params.prompt.findLast((message) => message.role !== "system");
    if (last?.role !== "tool" || last.content.some((part) => connectCard.safeParse(part).success)) {
      return first;
    }
    type Part = typeof first.stream extends ReadableStream<infer Each> ? Each : never;
    type Usage = Extract<Part, { type: "finish" }>["usage"];
    const says = (part: Part) =>
      SAYS.has(part.type) || (part.type === "text-delta" && part.delta.trim() !== "");
    const added = (a: Usage, b: Usage): Usage => ({
      ...b,
      inputTokens: {
        total: sum(a.inputTokens.total, b.inputTokens.total),
        noCache: sum(a.inputTokens.noCache, b.inputTokens.noCache),
        cacheRead: sum(a.inputTokens.cacheRead, b.inputTokens.cacheRead),
        cacheWrite: sum(a.inputTokens.cacheWrite, b.inputTokens.cacheWrite),
      },
      outputTokens: {
        total: sum(a.outputTokens.total, b.outputTokens.total),
        text: sum(a.outputTokens.text, b.outputTokens.text),
        reasoning: sum(a.outputTokens.reasoning, b.outputTokens.reasoning),
      },
    });
    const stream = new ReadableStream<Part>({
      async start(controller) {
        try {
          let said = false;
          let finish: Part | undefined;
          await first.stream.pipeTo(
            new WritableStream({
              write: (part) => {
                said ||= says(part);
                if (part.type === "finish") finish = part;
                else controller.enqueue(part);
              },
            }),
          );
          const silent =
            !said && finish?.type === "finish" && finish.finishReason.unified === "stop";
          const retried = silent
            ? await Promise.resolve(
                model.doStream({
                  ...params,
                  prompt: [...params.prompt, { role: "system", content: NUDGE }],
                }),
              ).catch(() => undefined)
            : undefined;
          if (!retried) {
            if (finish) controller.enqueue(finish);
          } else {
            console.warn("a silent step after a tool result was retried");
            await retried.stream.pipeTo(
              new WritableStream({
                write: (part) => {
                  if (part.type === "stream-start" || part.type === "response-metadata") return;
                  controller.enqueue(
                    part.type === "finish" && finish?.type === "finish"
                      ? { ...part, usage: added(finish.usage, part.usage) }
                      : part,
                  );
                },
              }),
            );
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return { ...first, stream };
  },
};
