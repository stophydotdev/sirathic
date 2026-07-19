import { z } from "zod";
import SearchAgent from "@/lib/agents/search";
import SessionManager from "@/lib/session";
import { getLLM } from "@/lib/models";
import { ChatTurnMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.object({
    content: z.string().min(1, "Message content is required"),
  }),
  optimizationMode: z.enum(["speed", "balanced", "quality"]).default("balanced"),
  history: z
    .array(z.tuple([z.enum(["human", "assistant"]), z.string()]))
    .optional()
    .default([]),
  model: z.string().optional(),
  systemInstructions: z.string().nullable().optional().default(""),
});

const writeEvent = (
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  payload: Record<string, unknown>,
) => {
  writer.write(encoder.encode(JSON.stringify(payload) + "\n"));
};

export const POST = async (req: Request) => {
  try {
    const parseBody = bodySchema.safeParse(await req.json());

    if (!parseBody.success) {
      return Response.json(
        {
          message: "Invalid request body",
          error: parseBody.error.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const body = parseBody.data;

    const history: ChatTurnMessage[] = body.history.map(([role, content]) => ({
      role: role === "human" ? "user" : "assistant",
      content,
    }));

    const llm = getLLM(body.model);

    const agent = new SearchAgent();
    const session = SessionManager.createSession();

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    writeEvent(writer, encoder, { type: "session", sessionId: session.id });

    const disconnect = session.subscribe((event: string, data: any) => {
      if (event === "data") {
        if (data.type === "block") {
          writeEvent(writer, encoder, { type: "block", block: data.block });
        } else if (data.type === "updateBlock") {
          writeEvent(writer, encoder, {
            type: "updateBlock",
            blockId: data.blockId,
            patch: data.patch,
          });
        } else if (data.type === "researchComplete") {
          writeEvent(writer, encoder, { type: "researchComplete" });
        }
      } else if (event === "end") {
        writeEvent(writer, encoder, { type: "messageEnd" });
        writer.close();
        session.removeAllListeners();
      } else if (event === "error") {
        writeEvent(writer, encoder, { type: "error", data: data.data });
        writer.close();
        session.removeAllListeners();
      }
    });

    agent.searchAsync(session, {
      chatHistory: history,
      followUp: body.message.content,
      config: {
        llm,
        mode: body.optimizationMode,
        systemInstructions: body.systemInstructions || "None",
      },
    });

    req.signal.addEventListener("abort", () => {
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
    console.error("An error occurred while processing chat request:", err);
    return Response.json(
      { message: "An error occurred while processing chat request" },
      { status: 500 },
    );
  }
};
