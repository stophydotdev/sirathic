import type { ChatMessage } from "../shared/messages";
import { reasonOf } from "../http";
import { DOCX, fileIdOf } from "../shared/files";
import { pdfText } from "../chat/pdf";
import { docxText } from "./docx";
import { storage } from "./storage";
import { fileOf } from "./store";

type Part = ChatMessage["parts"][number];

export async function bytesOf(url: string, owner: string | undefined) {
  if (url.startsWith("data:")) {
    return new Uint8Array(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
  }
  const id = fileIdOf(url);
  if (!id || !owner) return undefined;
  const file = await fileOf(id, owner);
  return file ? storage.bytes(file.key) : undefined;
}

async function readPart(part: Part, owner: string | undefined): Promise<Part> {
  if (part.type !== "file") return part;
  const isPdf = part.mediaType === "application/pdf";
  const isDocx = part.mediaType === DOCX;
  const isImage = part.mediaType.startsWith("image/");
  if (!isPdf && !isDocx && !isImage) return part;
  if (isImage && part.url.startsWith("data:")) return part;
  const bytes = await bytesOf(part.url, owner).catch((err: Error) => {
    console.error(`file not read: ${reasonOf(err)}`);
    return undefined;
  });
  if (isDocx) {
    const text = bytes ? docxText(bytes) : "This Word document could not be read.";
    return {
      type: "text",
      text: `<document name="${part.filename ?? "document.docx"}">\n${text}\n</document>`,
    };
  }
  if (isPdf) {
    const text = bytes ? await pdfText(bytes) : "This PDF could not be read.";
    return {
      type: "text",
      text: `<pdf name="${part.filename ?? "document.pdf"}">\n${text}\n</pdf>`,
    };
  }
  if (!bytes) {
    return {
      type: "text",
      text: `<image name="${part.filename ?? "image"}">\nThis image could not be read.\n</image>`,
    };
  }
  return { ...part, url: `data:${part.mediaType};base64,${Buffer.from(bytes).toString("base64")}` };
}

export const readFiles = (messages: ChatMessage[], owner: string | undefined) =>
  Promise.all(
    messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(message.parts.map((part) => readPart(part, owner))),
    })),
  );
