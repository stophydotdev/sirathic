import { z } from "zod";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_USER = 200;
export const FILE_NAME_MAX = 200;
export const FILE_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,.txt,.md,.csv,.json";

export const savedFiles = z.object({
  files: z.array(
    z.object({ id: z.uuid(), name: z.string(), mediaType: z.string(), size: z.number() }),
  ),
});

export type FileKind = "image" | "pdf" | "text";

export const kindOf = (mediaType: string): FileKind => {
  if (mediaType.startsWith("image/")) return "image";
  return mediaType === "application/pdf" ? "pdf" : "text";
};

export const fileUrl = (origin: string, id: string) => `${origin}/api/files/${id}`;

export const fileIdOf = (url: string) => {
  const parsed = URL.parse(url);
  if (parsed?.protocol !== "https:" && parsed?.protocol !== "http:") return undefined;
  return /^\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(
    parsed.pathname,
  )?.[1];
};

export const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FILE_SORTS = ["created", "name", "size"] as const;

export type FileSort = (typeof FILE_SORTS)[number];

type Listed = { name: string; size: number; createdAt: number; mediaType: string };

export const shownFiles = <File extends Listed>(
  files: File[],
  view: { query: string; kinds: readonly FileKind[]; sort: FileSort; descending: boolean },
) => {
  const query = view.query.trim().toLowerCase();
  const direction = view.descending ? -1 : 1;
  const compare = {
    created: (a: Listed, b: Listed) => a.createdAt - b.createdAt,
    name: (a: Listed, b: Listed) => a.name.localeCompare(b.name),
    size: (a: Listed, b: Listed) => a.size - b.size,
  }[view.sort];
  return files
    .filter(
      (file) =>
        view.kinds.includes(kindOf(file.mediaType)) && file.name.toLowerCase().includes(query),
    )
    .toSorted((a, b) => direction * compare(a, b));
};
