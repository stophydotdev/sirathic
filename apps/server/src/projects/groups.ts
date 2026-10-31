import { db } from "@sirathic/db";
import { projects } from "@sirathic/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "../http";
import { owned, projectId, projectName } from "./projects";

const MAX_GROUP_MEMBERS = 5;

export const groupInput = z.object({
  name: projectName,
  members: z.array(projectId).min(2).max(MAX_GROUP_MEMBERS),
});

const groupColumns = { id: projects.id, name: projects.name, members: projects.members };

const ownedGroups = (by: string) => and(eq(projects.owner, by), eq(projects.kind, "group"));

export const listGroups = (by: string) =>
  db
    .select(groupColumns)
    .from(projects)
    .where(ownedGroups(by))
    .orderBy(sql`lower(${projects.name})`);

export async function groupOf(id: string, by: string) {
  const [group] = await db
    .select(groupColumns)
    .from(projects)
    .where(and(owned(id, by), eq(projects.kind, "group")));
  return group;
}

export async function createGroup(by: string, { name, members }: z.output<typeof groupInput>) {
  const unique = [...new Set(members)];
  const found = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.owner, by), eq(projects.kind, "bot"), inArray(projects.id, unique)));
  if (unique.length < 2 || found.length !== unique.length) {
    throw new StatusError(400, "A group needs at least two of your bots.");
  }
  const [created] = await db
    .insert(projects)
    .values({ owner: by, name, kind: "group", members: unique })
    .returning(groupColumns);
  return created;
}
