import { fillRequest, screenMode } from "@sirathic/browser/protocol";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { z } from "zod";
import { siteHost } from "@sirathic/core/web/url";
import { userFor } from "../account/auth";
import { respond, StatusError } from "../http";
import { projectId, requireProject } from "../projects/projects";
import { saveLogin } from "../vault/vault";
import { browserPage, fillBrowser, screenSocket } from "./browser";
import { screenTicket, ticketFits } from "./screenTicket";

const fillBody = fillRequest
  .omit({ session: true })
  .extend({ domain: siteHost, save: z.boolean().optional() });

const ownBot = async (headers: Headers, id: string | undefined) => {
  const user = await userFor(headers);
  if (!user) throw new StatusError(401, "not signed in");
  const botId = projectId.parse(id);
  await requireProject(botId, user.id);
  return { botId, owner: user.id };
};

const bodyOf = async <Schema extends z.ZodType>(request: Request, schema: Schema) => {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) throw new StatusError(400, z.prettifyError(parsed.error));
  return parsed.data;
};

export const browserRoutes = new Hono();

browserRoutes.post("/:id/browser/ticket", (c) =>
  respond(async () => {
    const { botId } = await ownBot(c.req.raw.headers, c.req.param("id"));
    await browserPage(botId);
    return { ticket: screenTicket(botId) };
  }),
);

browserRoutes.get(
  "/:id/browser/screen",
  upgradeWebSocket((c) => {
    const botId = c.req.param("id") ?? "";
    const allowed = ticketFits(c.req.query("ticket") ?? "", botId);
    const mode = screenMode.catch("watch").parse(c.req.query("mode"));
    const pending: Parameters<WebSocket["send"]>[0][] = [];
    let upstream: WebSocket | undefined;
    return {
      onOpen: (_event, socket) => {
        if (!allowed) {
          socket.close(4401, "expired");
          return;
        }
        const opened = screenSocket(botId, mode);
        opened.binaryType = "arraybuffer";
        opened.addEventListener("open", () => {
          for (const chunk of pending.splice(0)) opened.send(chunk);
        });
        opened.addEventListener("message", (event: MessageEvent<string | ArrayBuffer>) =>
          socket.send(event.data),
        );
        opened.addEventListener("close", () => socket.close(4404, "closed"));
        upstream = opened;
      },
      onMessage: (event) => {
        if (upstream?.readyState === WebSocket.OPEN) upstream.send(event.data);
        else pending.push(event.data);
      },
      onClose: () => upstream?.close(),
    };
  }),
);

browserRoutes.post("/:id/browser/fill", (c) =>
  respond(async () => {
    const { botId, owner } = await ownBot(c.req.raw.headers, c.req.param("id"));
    const { fields, submit, domain, save } = await bodyOf(c.req.raw, fillBody);
    const filled = await fillBrowser(botId, { domain, fields, submit });
    const username = fields.find((field) => !field.secret)?.value;
    const password = fields.find((field) => field.secret)?.value;
    if (save && username && password && filled.fields.every((field) => field.filled)) {
      await saveLogin(owner, { site: domain, username, password });
    }
    return filled;
  }),
);
