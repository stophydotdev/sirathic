import type { ChatMessage } from "../shared/messages";
import { reasonOf } from "../http";
import { fileIdOf, kindOf } from "../shared/files";
import { pdfText } from "../chat/pdf";
import { storage } from "./storage";
import { FILE_CHARS, projectFilesRules, TOTAL_CHARS } from "../projects/files";
import { fileOf, projectFileKeys } from "./store";

type Part = ChatMessage["parts"][number];

async function bytesOf(url: string, owner: string | undefined) {
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
  const isImage = part.mediaType.startsWith("image/");
  if (!isPdf && !isImage) return part;
  if (isImage && part.url.startsWith("data:")) return part;
  const bytes = await bytesOf(part.url, owner).catch((err: Error) => {
    console.error(`file not read: ${reasonOf(err)}`);
    return undefined;
  });
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

type ProjectText = { name: string; text: string };

const readProjectFile = (file: { key: string; name: string; mediaType: string }) =>
  storage
    .bytes(file.key)
    .then((bytes) =>
      kindOf(file.mediaType) === "pdf" ? pdfText(bytes) : new TextDecoder().decode(bytes),
    )
    .then((text): ProjectText => ({ name: file.name, text }))
    .catch((err: Error) => {
      console.error(`project file not read: ${reasonOf(err)}`);
      return undefined;
    });

const charsRead = (texts: ProjectText[]) =>
  texts.reduce((sum, { text }) => sum + Math.min(text.length, FILE_CHARS), 0);

export async function readProjectFiles(owner: string, projectId: string) {
  const found = (await projectFileKeys(owner, projectId)).filter(
    (file) => kindOf(file.mediaType) !== "image",
  );
  const texts = await found.reduce<Promise<ProjectText[]>>(async (reading, file) => {
    const done = await reading;
    if (charsRead(done) >= TOTAL_CHARS) return done;
    const read = await readProjectFile(file);
    return read ? [...done, read] : done;
  }, Promise.resolve([]));
  return projectFilesRules(texts);
}
