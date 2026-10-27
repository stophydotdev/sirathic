import { z } from "zod";

const saved = z.object({ id: z.uuid() });
const failed = z.object({ error: z.string() });

const inLibrary = new WeakMap<File, string>();

export async function uploadToLibrary(file: File) {
  const known = inLibrary.get(file);
  if (known) return known;
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/files", { method: "POST", body: form });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(failed.safeParse(body).data?.error ?? `Could not upload ${file.name}`);
  }
  const { id } = saved.parse(body);
  inLibrary.set(file, id);
  return id;
}

export async function fileFromLibrary(file: { id: string; name: string; mediaType: string }) {
  const response = await fetch(`/api/files/${file.id}`);
  if (!response.ok) throw new Error(`Could not open ${file.name}`);
  const copy = new File([await response.blob()], file.name, { type: file.mediaType });
  inLibrary.set(copy, file.id);
  return copy;
}
