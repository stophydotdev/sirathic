import { extractText, getDocumentProxy } from "unpdf";
import type { ChatMessage } from "../shared/messages";

const PDF_CHARS = 60_000;

async function pdfText(url: string) {
  if (!url.startsWith("data:")) return "This PDF could not be read.";
  try {
    const bytes = new Uint8Array(
      Buffer.from(url.slice(url.indexOf(",") + 1), "base64"),
    );
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

export const readPdfs = (messages: ChatMessage[]) =>
  Promise.all(
    messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(
        message.parts.map(async (part) =>
          part.type === "file" && part.mediaType === "application/pdf"
            ? {
                type: "text" as const,
                text: `<pdf name="${part.filename ?? "document.pdf"}">\n${await pdfText(part.url)}\n</pdf>`,
              }
            : part,
        ),
      ),
    })),
  );
