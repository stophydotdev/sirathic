import { extractText, getDocumentProxy } from "unpdf";

const PDF_CHARS = 60_000;

export async function pdfText(bytes: Uint8Array) {
  try {
    const extracted = await extractText(await getDocumentProxy(bytes), {
      mergePages: true,
    });
    const text = extracted.text.normalize("NFKC").replaceAll("\u0000", "");
    if (!text.trim()) return "This PDF has no text layer. It may be a scan.";
    return text.length > PDF_CHARS
      ? `${text.slice(0, PDF_CHARS)}\n[Truncated: the PDF is longer than this.]`
      : text;
  } catch {
    return "This PDF could not be read.";
  }
}
