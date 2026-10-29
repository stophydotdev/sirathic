import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@sirathic/env/server";

const TICKET_MS = 60_000;

const signatureOf = (body: string) =>
  createHmac("sha256", `screen:${env.BROWSER_TOKEN}`).update(body).digest("base64url");

export const screenTicket = (botId: string, now = Date.now()) => {
  const body = `${botId}.${now + TICKET_MS}`;
  return `${body}.${signatureOf(body)}`;
};

export const ticketFits = (ticket: string, botId: string, now = Date.now()) => {
  const [id, expires, signature] = ticket.split(".");
  if (id !== botId || !expires || !signature || Number(expires) < now) return false;
  const expected = Buffer.from(signatureOf(`${id}.${expires}`));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
};
