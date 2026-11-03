import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { z } from "zod";
import { auth } from "../account/auth";
import { ticketFits, ticketFor } from "../bots/ticket";
import { track } from "../chat/events";
import { respond, StatusError } from "../http";
import { eventId, seenFrame } from "../shared/realtime";
import { type Device, isLive, join, leave, sentAt } from "./hub";

const ticketSubject = z
  .string()
  .regex(/^realtime:[^:.]+:[^:.]+$/u)
  .transform((subject) => {
    const [, owner = "", sessionId = ""] = subject.split(":");
    return { subject, owner, sessionId };
  });

const subjectOf = (owner: string, sessionId: string) => `realtime:${owner}:${sessionId}`;

export const realtimeRoutes = new Hono();

realtimeRoutes.post("/ticket", (c) =>
  respond(async () => {
    const found = await auth.api.getSession({
      headers: c.req.raw.headers,
      query: { disableRefresh: true },
    });
    if (!found) throw new StatusError(401, "not signed in");
    if (!isLive(found.user.id)) throw new StatusError(404, "not live");
    return { ticket: ticketFor(subjectOf(found.user.id, found.session.id)) };
  }),
);

realtimeRoutes.get(
  "/",
  upgradeWebSocket((c) => {
    const ticket = c.req.query("ticket") ?? "";
    const claimed = ticketSubject.safeParse(ticket.split(".")[0]);
    const holder =
      claimed.success && ticketFits(ticket, claimed.data.subject) && isLive(claimed.data.owner)
        ? claimed.data
        : undefined;
    const after = eventId.optional().catch(undefined).parse(c.req.query("after"));
    let device: Device | undefined;
    return {
      onOpen: (_event, socket) => {
        if (!holder) {
          socket.close(4401, "expired");
          return;
        }
        device = {
          owner: holder.owner,
          sessionId: holder.sessionId,
          send: (frame) => socket.send(JSON.stringify(frame)),
          close: (code, reason) => socket.close(code, reason),
          ping: () => socket.raw?.ping(),
          arrivedWhileJoining: undefined,
        };
        void join(device, after);
      },
      onMessage: (event) => {
        const text = z.string().safeParse(event.data);
        const seen = text.success ? seenFrame.safeParse(JSON.parse(text.data)) : undefined;
        if (!device || !seen?.success) return;
        track(
          { name: "realtime.seen", props: { ms: Date.now() - sentAt(seen.data.id) } },
          device.owner,
        );
      },
      onClose: () => {
        if (device) leave(device);
      },
    };
  }),
);
