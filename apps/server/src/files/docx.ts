import { strFromU8, Unzip, UnzipInflate } from "fflate";

const BODY = "word/document.xml";
const DOCX_CHARS = 60_000;
const BODY_BYTES = 20_000_000;
const CHUNK_BYTES = 4_096;
const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

const bodyOf = (bytes: Uint8Array) => {
  const parts: Uint8Array[] = [];
  let size = 0;
  const unzip = new Unzip((file) => {
    if (file.name !== BODY) return;
    file.ondata = (err, chunk) => {
      if (err) throw err;
      size += chunk.length;
      if (size > BODY_BYTES) throw new RangeError("the Word body is too large");
      parts.push(chunk);
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let at = 0; at < bytes.length; at += CHUNK_BYTES) {
      unzip.push(bytes.subarray(at, at + CHUNK_BYTES), at + CHUNK_BYTES >= bytes.length);
    }
  } catch {
    return undefined;
  }
  return parts.length === 0 ? undefined : Buffer.concat(parts);
};

export const isDocx = (bytes: Uint8Array) =>
  bytes[0] === 0x50 && bytes[1] === 0x4b && bodyOf(bytes) !== undefined;

export function docxText(bytes: Uint8Array) {
  const body = bodyOf(bytes);
  if (!body) return "This Word document could not be read.";
  const text = strFromU8(body)
    .replaceAll(/<w:delText\b[^>]*>[^<]*<\/w:delText>/gu, "")
    .replaceAll("<w:tab/>", "\t")
    .replaceAll(/<w:br\b[^>]*\/>|<\/w:p>/gu, "\n")
    .replaceAll(/<[^>]+>/gu, "")
    .replaceAll(/&(amp|lt|gt|quot|apos);/gu, (_, name: string) => ENTITIES.get(name) ?? "")
    .replaceAll(/&#(x?)([0-9a-f]+);/giu, (_, hex: string, code: string) =>
      String.fromCodePoint(Number.parseInt(code, hex ? 16 : 10)),
    )
    .trim();
  if (!text) return "This Word document has no text.";
  return text.length > DOCX_CHARS
    ? `${text.slice(0, DOCX_CHARS)}\n[Truncated: the document is longer than this.]`
    : text;
}
