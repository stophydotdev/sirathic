import { bytesOf } from "../files/attachments";
import { storage } from "../files/storage";
import type { ChatMessage } from "../shared/messages";
import { mediaTypeOf } from "../files/sniff";
import { FILE_NAME_MAX, formatSize, MAX_FILE_BYTES } from "../shared/files";

const MAX_FILES = 50;

export const diskName = (name: string) =>
  name.replaceAll(/[/\\]/gu, "-").trim().slice(-FILE_NAME_MAX) || "file";

export function botDisk(botId: string) {
  const prefix = `bots/${botId}/files/`;
  const list = async () =>
    (await storage.list(prefix)).map(({ key, size }) => ({ name: key.slice(prefix.length), size }));
  return {
    list,
    read: (name: string) => storage.bytes(prefix + diskName(name)),
    write: async (name: string, bytes: Uint8Array) => {
      const named = diskName(name);
      if (bytes.length > MAX_FILE_BYTES) {
        throw new Error(`${named} is over ${formatSize(MAX_FILE_BYTES)}, so it was not kept.`);
      }
      const files = await list();
      if (files.length >= MAX_FILES && !files.some((file) => file.name === named)) {
        throw new Error(`Your files are full (${MAX_FILES} at most). Delete one first.`);
      }
      await storage.put(prefix + named, bytes, mediaTypeOf(bytes) ?? "application/octet-stream");
      return named;
    },
    remove: (name: string) => storage.remove(prefix + diskName(name)),
    clear: async () => {
      await Promise.all((await list()).map(({ name }) => storage.remove(prefix + name)));
    },
  };
}

export type BotDisk = ReturnType<typeof botDisk>;

export const keepAttachments = async (
  disk: BotDisk,
  message: ChatMessage | undefined,
  owner: string,
) =>
  Promise.all(
    (message?.parts ?? []).map(async (part) => {
      if (part.type !== "file") return;
      const bytes = await bytesOf(part.url, owner).catch(() => undefined);
      if (bytes) await disk.write(part.filename ?? "attachment", bytes).catch(() => undefined);
    }),
  );
