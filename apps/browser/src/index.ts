import type { ServerWebSocket, Socket } from "bun";
import { z } from "zod";
import { fill } from "./control";
import { login } from "./login";
import { fillRequest, loginRequest, request, screenRequest, sessionRequest } from "./protocol";
import { reasonOf, run } from "./run";
import {
  BusyError,
  ClosedError,
  endControl,
  existing,
  forget,
  hold,
  InUseError,
  inOpenSession,
  inSession,
  openSessions,
  pageOf,
  startControl,
} from "./sessions";
import { settings } from "./settings";

const failed = (error: string, status: number) => Response.json({ error }, { status });

const authorized = (incoming: Request) =>
  incoming.headers.get("authorization") === `Bearer ${settings.BROWSER_TOKEN}`;

const handled = async <Schema extends z.ZodType>(
  incoming: Request,
  schema: Schema,
  work: (body: z.infer<Schema>) => Promise<Response>,
) => {
  if (!authorized(incoming)) return failed("Unauthorized.", 401);
  const parsed = schema.safeParse(await incoming.json().catch(() => undefined));
  if (!parsed.success) return failed(z.prettifyError(parsed.error), 400);
  try {
    return await work(parsed.data);
  } catch (error) {
    if (error instanceof BusyError) return failed(error.message, 503);
    if (error instanceof ClosedError) return failed(error.message, 404);
    if (error instanceof InUseError) return failed(error.message, 409);
    return failed(error instanceof Error ? reasonOf(error) : String(error), 422);
  }
};

const done = () => new Response(null, { status: 204 });

type Viewer = z.infer<typeof screenRequest> & {
  vnc?: Socket;
  pending: (string | Buffer)[];
  closed: boolean;
  controlling: boolean;
};

Bun.serve({
  port: settings.PORT,
  idleTimeout: 120,
  routes: {
    "/health": () => Response.json({ sessions: openSessions() }),
    "/act": {
      POST: (incoming) =>
        handled(incoming, request, async ({ session, action }) =>
          Response.json(
            await inSession(session, (open) => run(open, action)).catch((error: Error) => {
              console.error(
                JSON.stringify({ kind: action.kind, error: String(error).slice(0, 2_000) }),
              );
              throw error;
            }),
          ),
        ),
    },
    "/fill": {
      POST: (incoming) =>
        handled(incoming, fillRequest, async ({ session, ...form }) =>
          Response.json(await inOpenSession(session, (open) => fill(open, form))),
        ),
    },
    "/page": {
      POST: (incoming) =>
        handled(incoming, sessionRequest, async ({ session }) =>
          Response.json(await pageOf(session)),
        ),
    },
    "/hold": {
      POST: (incoming) =>
        handled(incoming, sessionRequest, async ({ session }) => {
          await hold(session);
          return done();
        }),
    },
    "/login": {
      POST: (incoming) =>
        handled(incoming, loginRequest, async (body) =>
          Response.json(await inOpenSession(body.session, (open) => login(open, body))),
        ),
    },
    "/forget": {
      POST: (incoming) =>
        handled(incoming, sessionRequest, async ({ session }) => {
          await forget(session);
          return done();
        }),
    },
  },
  fetch: async (incoming, server) => {
    if (new URL(incoming.url).pathname !== "/screen") return failed("Not found.", 404);
    const offered = incoming.headers.get("sec-websocket-protocol")?.split(",") ?? [];
    if (!offered.some((protocol) => protocol.trim() === settings.BROWSER_TOKEN)) {
      return failed("Unauthorized.", 401);
    }
    const params = new URL(incoming.url).searchParams;
    const parsed = screenRequest.safeParse({
      session: params.get("session"),
      mode: params.get("mode"),
    });
    if (!parsed.success) return failed(z.prettifyError(parsed.error), 400);
    if (!(await existing(parsed.data.session))) return failed("Your bot's browser is closed.", 404);
    const data: Viewer = { ...parsed.data, pending: [], closed: false, controlling: false };
    if (server.upgrade(incoming, { data, headers: { "sec-websocket-protocol": "screen" } })) {
      return undefined;
    }
    return failed("Expected a WebSocket.", 400);
  },
  websocket: {
    async open(socket: ServerWebSocket<Viewer>) {
      const session = await existing(socket.data.session);
      if (!session) {
        socket.close(4404, "closed");
        return;
      }
      if (socket.data.mode === "control") {
        socket.data.controlling = true;
        await startControl(session);
      }
      socket.data.vnc = await Bun.connect({
        hostname: "127.0.0.1",
        port: session.screen.port,
        socket: {
          data: (_vnc, chunk) => {
            if (socket.data.controlling) session.lastUsed = Date.now();
            socket.sendBinary(chunk);
          },
          close: () => socket.close(4404, "closed"),
          error: () => socket.close(4404, "closed"),
        },
      }).catch(() => undefined);
      if (!socket.data.vnc) {
        socket.close(4404, "closed");
        return;
      }
      for (const chunk of socket.data.pending.splice(0)) socket.data.vnc.write(chunk);
      if (socket.data.closed) socket.data.vnc.end();
    },
    message(socket: ServerWebSocket<Viewer>, message: string | Buffer) {
      if (socket.data.vnc) socket.data.vnc.write(message);
      else socket.data.pending.push(message);
    },
    async close(socket: ServerWebSocket<Viewer>) {
      socket.data.closed = true;
      socket.data.vnc?.end();
      const session = await existing(socket.data.session);
      if (session && socket.data.controlling) await endControl(session);
    },
  },
});
