import { db } from "@sirathic/db";
import { loginSessions } from "@sirathic/db/schema";
import { and, desc, eq, gt, ne } from "drizzle-orm";

const BROWSERS = [
  ["Edg/", "Edge"],
  ["OPR/", "Opera"],
  ["SamsungBrowser/", "Samsung Internet"],
  ["Firefox/", "Firefox"],
  ["Chrome/", "Chrome"],
  ["Safari/", "Safari"],
] as const;

const SYSTEMS = [
  ["Android", "Android"],
  ["okhttp", "Android"],
  ["iPhone", "iOS"],
  ["iPad", "iPadOS"],
  ["Darwin", "iOS"],
  ["CrOS", "ChromeOS"],
  ["Windows", "Windows"],
  ["Mac OS X", "macOS"],
  ["Linux", "Linux"],
] as const;

export const deviceOf = (agent: string | null) => {
  if (!agent) return { kind: "unknown" } as const;
  const system = SYSTEMS.find(([mark]) => agent.includes(mark))?.[1];
  if (!agent.startsWith("Mozilla/") || agent.includes("Electron/")) {
    return { kind: "app", system } as const;
  }
  const browser = BROWSERS.find(([mark]) => agent.includes(mark))?.[1];
  return browser ? ({ kind: "browser", browser, system } as const) : ({ kind: "unknown" } as const);
};

export async function listDevices(owner: string, current: string) {
  const rows = await db
    .select({
      id: loginSessions.id,
      userAgent: loginSessions.userAgent,
      updatedAt: loginSessions.updatedAt,
    })
    .from(loginSessions)
    .where(and(eq(loginSessions.userId, owner), gt(loginSessions.expiresAt, new Date())))
    .orderBy(desc(loginSessions.updatedAt));
  return rows.map((row) => ({
    id: row.id,
    current: row.id === current,
    lastActive: row.updatedAt.toISOString(),
    device: deviceOf(row.userAgent),
  }));
}

export async function signOutOthers(owner: string, current: string) {
  const removed = await db
    .delete(loginSessions)
    .where(and(eq(loginSessions.userId, owner), ne(loginSessions.id, current)))
    .returning({ id: loginSessions.id });
  return { signedOut: removed.length };
}

export async function signOutDevice(owner: string, current: string, id: string) {
  if (id === current) return { signedOut: 0 };
  const removed = await db
    .delete(loginSessions)
    .where(and(eq(loginSessions.userId, owner), eq(loginSessions.id, id)))
    .returning({ id: loginSessions.id });
  return { signedOut: removed.length };
}
