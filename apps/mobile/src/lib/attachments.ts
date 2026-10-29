import { fileUrl } from "@sirathic/server/files";
import type { FileUIPart } from "ai";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { z } from "zod";
import { API_URL, sessionHeaders } from "./auth";
import { useChatState } from "./chat-state";

export type Attachment = {
  key: string;
  name: string;
  mediaType: string;
  uri: string;
  size: number;
};

const PICKABLE = ["image/*", "application/pdf", "text/*", "application/json"];

const saved = z.object({ id: z.uuid() });
const failed = z.object({ error: z.string() });

const json = z.string().transform((text, ctx) => {
  try {
    return JSON.parse(text);
  } catch {
    ctx.addIssue({ code: "custom", message: "not json" });
    return z.NEVER;
  }
});

export const pickFiles = async (): Promise<Attachment[]> => {
  const picked = await DocumentPicker.getDocumentAsync({
    type: PICKABLE,
    multiple: true,
    copyToCacheDirectory: false,
  });
  if (picked.canceled) return [];
  return picked.assets.map((asset) => ({
    key: asset.uri,
    name: asset.name,
    mediaType: asset.mimeType ?? "application/octet-stream",
    uri: asset.uri,
    size: asset.size ?? 0,
  }));
};

const imagesOf = (picked: ImagePicker.ImagePickerResult): Attachment[] =>
  picked.canceled
    ? []
    : picked.assets.map((asset) => ({
        key: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        mediaType: asset.mimeType ?? "image/jpeg",
        uri: asset.uri,
        size: asset.fileSize ?? 0,
      }));

export const takePhoto = async () => {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) return [];
  return imagesOf(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }));
};

export const pickPhotos = async () =>
  imagesOf(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    }),
  );

const multipart = (file: Attachment, bytes: Uint8Array) => {
  const boundary = `sirathic${Date.now()}`;
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name.replace(/["\r\n]/gu, "")}"\r\nContent-Type: ${file.mediaType}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body, type: `multipart/form-data; boundary=${boundary}` };
};

const upload = async (file: Attachment) => {
  const { body, type } = multipart(file, await new File(file.uri).bytes());
  const response = await fetch(`${API_URL}/api/files`, {
    method: "POST",
    headers: { ...(await sessionHeaders()), "content-type": type },
    body,
  });
  const answer = json.catch(undefined).parse(await response.text());
  if (!response.ok) {
    throw new Error(failed.safeParse(answer).data?.error ?? `Could not upload ${file.name}`);
  }
  return fileUrl(API_URL, saved.parse(answer).id);
};

const inline = async (file: Attachment) =>
  `data:${file.mediaType};base64,${await new File(file.uri).base64()}`;

const urlOf = (file: Attachment) =>
  useChatState.getState().incognito ? inline(file) : upload(file);

export const filePartsOf = (files: Attachment[]) =>
  Promise.all(
    files.map(async (file): Promise<FileUIPart> => ({
      type: "file",
      mediaType: file.mediaType,
      filename: file.name,
      url: await urlOf(file),
    })),
  );
