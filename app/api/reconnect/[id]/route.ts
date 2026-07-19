import SessionManager from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const session = SessionManager.getSession(id);

    if (!session) {
      return Response.json({ message: "Session not found" }, { status: 404 });
    }

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const write = (payload: Record<string, unknown>) => {
      writer.write(encoder.encode(JSON.stringify(payload) + "\n"));
    };

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
      } else if (event === "error") {
        write({ type: "error", data: data.data });
        writer.close();
      }
    });

    _req.signal.addEventListener("abort", () => {
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
  } catch (err) {
    console.error("An error occurred while reconnecting:", err);
    return Response.json(
      { message: "An error occurred while reconnecting" },
      { status: 500 },
    );
  }
};
