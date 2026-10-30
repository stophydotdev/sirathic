import { strFromU8, unzipSync } from "fflate";

const BODY = "word/document.xml";
const DOCX_CHARS = 60_000;
const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

const bodyOf = (bytes: Uint8Array) => {
  try {
    return unzipSync(bytes, { filter: (file) => file.name === BODY })[BODY];
  } catch {
    return undefined;
  }
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
