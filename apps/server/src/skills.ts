import { db } from "@sirathic/db";
import { skills } from "@sirathic/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "./respond";
import { mentionedSkills } from "./skillMentions";

const MAX_SKILLS = 20;

export const skillInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(40),
  instructions: z.string().trim().min(1).max(4000),
});

export const listSkills = (owner: string) =>
  db
    .select({ id: skills.id, name: skills.name, instructions: skills.instructions })
    .from(skills)
    .where(eq(skills.owner, owner))
    .orderBy(sql`lower(${skills.name})`);

export async function saveSkill(owner: string, input: z.output<typeof skillInput>) {
  const { id, name, instructions } = input;
  const [taken] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.owner, owner), sql`lower(${skills.name}) = ${name.toLowerCase()}`));
  if (taken && taken.id !== id) {
    throw new StatusError(400, "You already have a skill with that name.");
  }
  if (id) {
    const [updated] = await db
      .update(skills)
      .set({ name, instructions })
      .where(and(eq(skills.id, id), eq(skills.owner, owner)))
      .returning({ id: skills.id });
    if (!updated) throw new StatusError(404, "no such skill");
    return updated;
  }
  const [{ total }] = await db
    .select({ total: count() })
    .from(skills)
    .where(eq(skills.owner, owner));
  if (total >= MAX_SKILLS) {
    throw new StatusError(400, `You can have at most ${MAX_SKILLS} skills.`);
  }
  const [created] = await db
    .insert(skills)
    .values({ owner, name, instructions })
    .returning({ id: skills.id });
  return created;
}

export async function removeSkill(owner: string, id: string) {
  await db.delete(skills).where(and(eq(skills.id, id), eq(skills.owner, owner)));
}

export async function skillRules(owner: string, text: string) {
  const called = mentionedSkills(text, await listSkills(owner));
  if (called.length === 0) return "";
  const sections = called.map((skill) => `### ${skill.name}\n${skill.instructions}`);
  return `\n\nThe user called these skills with @. Follow them for this answer.\n\n${sections.join("\n\n")}`;
}
