import { fillRequest, userInput } from "@sirathic/browser/protocol";
import { Hono } from "hono";
import { z } from "zod";
import { isOnSite, siteHost } from "@sirathic/core/web/url";
import { userFor } from "../account/auth";
import { respond, StatusError } from "../http";
import { projectId, requireProject } from "../projects/projects";
import { saveLogin } from "../vault/vault";
import { browserPage, controlBrowser, fillBrowser, watchBrowser } from "./browser";

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

browserRoutes.get("/:id/browser/view", (c) =>
  respond(async () => {
    const { botId } = await ownBot(c.req.raw.headers, c.req.param("id"));
    const upstream = await watchBrowser(botId, c.req.raw.signal);
    if (!upstream.ok || !upstream.body) throw new StatusError(502, "the browser is unavailable");
    return new Response(upstream.body, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform" },
    });
  }),
);

browserRoutes.post("/:id/browser/input", (c) =>
  respond(async () => {
    const { botId } = await ownBot(c.req.raw.headers, c.req.param("id"));
    await controlBrowser(botId, await bodyOf(c.req.raw, userInput));
    return new Response(null, { status: 204 });
  }),
);

browserRoutes.post("/:id/browser/fill", (c) =>
  respond(async () => {
    const { botId, owner } = await ownBot(c.req.raw.headers, c.req.param("id"));
    const { fields, submit, domain, save } = await bodyOf(c.req.raw, fillBody);
    const host = siteHost.parse((await browserPage(botId)).url);
    if (!isOnSite(host, domain) && !isOnSite(domain, host)) {
      throw new StatusError(400, `The page is on ${host}, not ${domain}.`);
    }
    const filled = await fillBrowser(botId, fields, submit);
    const username = fields.find((field) => !field.secret)?.value;
    const password = fields.find((field) => field.secret)?.value;
    if (save && username && password && filled.fields.every((field) => field.filled)) {
      await saveLogin(owner, { site: host, username, password });
    }
    return filled;
  }),
);
