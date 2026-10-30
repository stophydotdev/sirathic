import { db } from "@sirathic/db";
import { chatSessions, events, files, settings, users } from "@sirathic/db/schema";
import { eq } from "drizzle-orm";
import { listAutomations } from "../automations/store";
import { exportSessions } from "../chat/sessions";
import { listFiles } from "../files/store";
import { storage } from "../files/storage";
import { listProjects, removeProject } from "../projects/projects";
import { listSkills } from "../skills/skills";
import { getSettings } from "./settings";

export const exportData = async (owner: string) => ({
  exportedAt: new Date().toISOString(),
  settings: await getSettings(owner),
  chats: await exportSessions(owner),
  bots: await listProjects(owner),
  routines: await listAutomations(owner),
  skills: await listSkills(owner),
  files: await listFiles(owner),
});

export async function deleteAccount(owner: string) {
  const bots = await listProjects(owner);
  await Promise.all(bots.map(({ id }) => removeProject(id, owner)));
  const stored = await db.select({ key: files.key }).from(files).where(eq(files.owner, owner));
  await Promise.all(stored.map(({ key }) => storage.remove(key)));
  await db.transaction(async (tx) => {
    await tx.delete(chatSessions).where(eq(chatSessions.owner, owner));
    await tx.delete(settings).where(eq(settings.owner, owner));
    await tx.delete(events).where(eq(events.owner, owner));
    await tx.delete(users).where(eq(users.id, owner));
  });
}
