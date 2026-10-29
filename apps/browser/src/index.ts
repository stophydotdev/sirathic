import { z } from "zod";
import { control, fill } from "./control";
import { login } from "./login";
import { fillRequest, inputRequest, loginRequest, request, sessionRequest } from "./protocol";
import { reasonOf, run } from "./run";
import { BusyError, ClosedError, forget, inOpenSession, inSession, openSessions } from "./sessions";
import { settings } from "./settings";
import { view } from "./view";

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
    return failed(error instanceof Error ? reasonOf(error) : String(error), 422);
  }
};

const done = () => new Response(null, { status: 204 });

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
    "/input": {
      POST: (incoming) =>
        handled(incoming, inputRequest, async ({ session, input }) => {
          await inOpenSession(session, (open) => control(open, input));
          return done();
        }),
    },
    "/fill": {
      POST: (incoming) =>
        handled(incoming, fillRequest, async ({ session, fields, submit }) =>
          Response.json(await inOpenSession(session, (open) => fill(open, fields, submit))),
        ),
    },
    "/page": {
      POST: (incoming) =>
        handled(incoming, sessionRequest, async ({ session }) =>
          Response.json(
            await inOpenSession(session, async ({ page }) => ({
              url: page.url(),
              title: await page.title().catch(() => ""),
            })),
          ),
        ),
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
    "/view": (incoming) => {
      if (!authorized(incoming)) return failed("Unauthorized.", 401);
      const parsed = sessionRequest.safeParse({
        session: new URL(incoming.url).searchParams.get("session"),
      });
      if (!parsed.success) return failed(z.prettifyError(parsed.error), 400);
      return view(parsed.data.session, incoming.signal);
    },
  },
  fetch: () => failed("Not found.", 404),
});
