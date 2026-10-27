import { db } from "@sirathic/db";
import { files, projects } from "@sirathic/db/schema";
import { type AnyColumn, and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "../http";
import { FILE_NAME_MAX, MAX_FILES_PER_USER } from "../shared/files";
import { storage } from "./storage";

export const fileId = z.uuid();

export const fileName = z.string().trim().min(1).max(FILE_NAME_MAX);

const millis = (column: AnyColumn) => sql<number>`(extract(epoch from ${column}) * 1000)::float8`;

const listedColumns = {
  id: files.id,
  name: files.name,
  mediaType: files.mediaType,
  size: files.size,
  projectId: files.projectId,
  createdAt: millis(files.createdAt),
};

const owned = (id: string, by: string) => and(eq(files.id, id), eq(files.owner, by));

export const listFiles = (by: string, projectId?: string) =>
  db
    .select(listedColumns)
    .from(files)
    .where(and(eq(files.owner, by), projectId ? eq(files.projectId, projectId) : undefined))
    .orderBy(desc(files.createdAt));

export const projectFileKeys = (by: string, projectId: string) =>
  db
    .select({ key: files.key, name: files.name, mediaType: files.mediaType })
    .from(files)
    .where(and(eq(files.owner, by), eq(files.projectId, projectId)))
    .orderBy(files.createdAt);

export const fileOf = async (id: string, by: string) => {
  const [file] = await db
    .select({ key: files.key, name: files.name, mediaType: files.mediaType })
    .from(files)
    .where(owned(id, by));
  return file;
};

export async function saveFile(
  by: string,
  upload: {
    name: string;
    mediaType: string;
    bytes: Uint8Array;
    projectId: string | undefined;
  },
) {
  const [{ total }] = await db.select({ total: count() }).from(files).where(eq(files.owner, by));
  if (total >= MAX_FILES_PER_USER) {
    throw new StatusError(
      400,
      `Your library is full. Delete a file first (${MAX_FILES_PER_USER} at most).`,
    );
  }
  if (upload.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, upload.projectId), eq(projects.owner, by)));
    if (!project) throw new StatusError(404, "no such project");
  }
  const id = crypto.randomUUID();
  const key = `${by}/${id}`;
  await storage.put(key, upload.bytes, upload.mediaType);
  try {
    const [saved] = await db
      .insert(files)
      .values({
        id,
        owner: by,
        key,
        name: upload.name,
        mediaType: upload.mediaType,
        size: upload.bytes.length,
        projectId: upload.projectId,
      })
      .returning(listedColumns);
    return saved;
  } catch (err) {
    await storage.remove(key).catch(() => undefined);
    throw err;
  }
}

export async function renameFile(id: string, by: string, name: string) {
  const [renamed] = await db
    .update(files)
    .set({ name })
    .where(owned(id, by))
    .returning(listedColumns);
  if (!renamed) throw new StatusError(404, "no such file");
  return renamed;
}

export async function removeFile(id: string, by: string) {
  const file = await fileOf(id, by);
  if (!file) return;
  await storage.remove(file.key);
  await db.delete(files).where(owned(id, by));
}
