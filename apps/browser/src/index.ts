import { z } from "zod";
import { request } from "./protocol";
import { run } from "./run";
import { BusyError, inSession, openSessions } from "./sessions";

const settings = z
  .object({
    BROWSER_TOKEN: z.string().min(16),
    PORT: z.coerce.number().default(8080),
  })
  .parse(process.env);

const failed = (error: string, status: number) => Response.json({ error }, { status });

const firstLine = (error: Error) => error.message.split("\n")[0] ?? error.message;

const reasonOf = (error: Error) =>
  /Timeout \d+ms exceeded/u.test(error.message) && /aria-ref=/u.test(error.message)
    ? `${firstLine(error)} The ref may be gone or hidden: take a new browser_snapshot or use browser_find, then try a ref from it.`
    : firstLine(error);

Bun.serve({
  port: settings.PORT,
  idleTimeout: 120,
  routes: {
    "/health": () => Response.json({ sessions: openSessions() }),
    "/act": {
      POST: async (incoming) => {
        if (incoming.headers.get("authorization") !== `Bearer ${settings.BROWSER_TOKEN}`) {
          return failed("Unauthorized.", 401);
        }
        const parsed = request.safeParse(await incoming.json().catch(() => undefined));
        if (!parsed.success) return failed(z.prettifyError(parsed.error), 400);
        const { session, action } = parsed.data;
        try {
          return Response.json(await inSession(session, (open) => run(open, action)));
        } catch (error) {
          if (error instanceof BusyError) return failed(error.message, 503);
          console.error(
            JSON.stringify({ kind: action.kind, error: String(error).slice(0, 2_000) }),
          );
          return failed(error instanceof Error ? reasonOf(error) : String(error), 422);
        }
      },
    },
  },
  fetch: () => failed("Not found.", 404),
});
