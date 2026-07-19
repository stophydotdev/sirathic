import SessionManager from "@sirathic/core/session";

export const streamSession = (
  session: SessionManager,
  signal: AbortSignal,
  firstEvent?: Record<string, unknown>,
): Response => {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const write = (payload: Record<string, unknown>) => {
    writer.write(encoder.encode(JSON.stringify(payload) + "\n"));
  };

  if (firstEvent) write(firstEvent);

  const disconnect = session.subscribe((event: string, data: any) => {
    if (event === "data") {
      if (data.type === "block") {
        write({ type: "block", block: data.block });
      } else if (data.type === "updateBlock") {
        write({
          type: "updateBlock",
          blockId: data.blockId,
          patch: data.patch,
        });
      } else if (data.type === "researchComplete") {
        write({ type: "researchComplete" });
      }
    } else if (event === "end") {
      write({ type: "messageEnd" });
      writer.close();
      session.removeAllListeners();
    } else if (event === "error") {
      write({ type: "error", data: data.data });
      writer.close();
      session.removeAllListeners();
    }
  });

  signal.addEventListener("abort", () => {
    disconnect();
    writer.close().catch(() => {});
  });

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
};
