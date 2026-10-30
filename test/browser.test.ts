import { expect, spyOn, test } from "bun:test";
import { isPrivateUrl } from "../apps/browser/src/blocked";
import { exitZone } from "../apps/browser/src/exit";
import { masked } from "../apps/browser/src/mask";
import { screenTicket, ticketFits } from "../apps/server/src/bots/screenTicket";
import { totp } from "../apps/server/src/vault/totp";

test("pages can't take a bot's browser to private or internal hosts", () => {
  const blocked = [
    "http://127.0.0.1:8080/health",
    "http://localhost:3000/",
    "http://api.railway.internal:3000/",
    "http://10.1.2.3/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://intranet/",
  ];
  expect(blocked.filter((url) => !isPrivateUrl(url))).toEqual([]);
  expect(isPrivateUrl("https://the-internet.herokuapp.com/login")).toBe(false);
});

test("a failed timezone lookup is tried again on the next session", async () => {
  const lookups = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ status: 429, error: { title: "Rate limit exceeded" } }))
    .mockResolvedValueOnce(Response.json({ timezone: "America/New_York" }));
  expect(await exitZone()).toBeUndefined();
  expect(await exitZone()).toBe("America/New_York");
  expect(await exitZone()).toBe("America/New_York");
  expect(lookups).toHaveBeenCalledTimes(2);
  lookups.mockRestore();
});

test("two-step codes match the RFC 6238 test vector", () => {
  expect(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  expect(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1_111_111_109_000)).toBe("081804");
});

test("a secret is masked in every spelling a page can show it, and nothing else changes", () => {
  const shown = masked(
    'a ?q=p%40ss%20w%22rd%21 b ?q=p%40ss+w%22rd! c {"v":"p@ss w\\"rd!"} d ?q=prayer%26mat',
    ['p@ss w"rd!'],
  );
  expect(shown).toBe('a ?q=•••••• b ?q=•••••• c {"v":"••••••"} d ?q=prayer%26mat');
});

test("a screen ticket opens only its own bot's screen, and only for a minute", () => {
  const bot = "8bc4443d-047a-49e6-b335-9cf3fa71d658";
  const ticket = screenTicket(bot, 1_000);
  expect(ticketFits(ticket, bot, 2_000)).toBe(true);
  expect(ticketFits(ticket, "53f15e17-feea-458d-80b0-0f767c35455b", 2_000)).toBe(false);
  expect(ticketFits(ticket, bot, 62_000)).toBe(false);
  expect(
    ticketFits(
      ticket.replace(/.$/u, (last) => (last === "A" ? "B" : "A")),
      bot,
      2_000,
    ),
  ).toBe(false);
  expect(ticketFits(`${bot}.999999999999999.forged`, bot, 2_000)).toBe(false);
});
