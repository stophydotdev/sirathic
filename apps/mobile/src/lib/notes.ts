import { z } from "zod";

const noteKind = z.enum(["note", "tip", "important", "warning", "caution"]);

export type NoteKind = z.infer<typeof noteKind>;

const NOTE = /^> ?\[!(note|tip|important|warning|caution)\][^\n]*\n?((?:>[^\n]*(?:\n|$))*)/gimu;

export const notesOf = (text: string) => {
  const parts: ({ kind: "text"; text: string } | { kind: "note"; note: NoteKind; text: string })[] =
    [];
  let at = 0;
  for (const found of text.matchAll(NOTE)) {
    const note = noteKind.safeParse(found[1]?.toLowerCase()).data;
    if (!note) continue;
    if (found.index > at) parts.push({ kind: "text", text: text.slice(at, found.index) });
    const body = (found[2] ?? "").replace(/^> ?/gmu, "").trim();
    parts.push({ kind: "note", note, text: body });
    at = found.index + found[0].length;
  }
  if (at < text.length) parts.push({ kind: "text", text: text.slice(at) });
  return parts;
};
