import { expect, mock, test } from "bun:test";
import { fileIdOf, formatSize, shownFiles } from "../apps/server/src/shared/files";
import { mediaTypeOf } from "../apps/server/src/files/sniff";

const src = `${import.meta.dir}/../apps/server/src`;
const fileA = "3f2b8c1e-5d4a-4e6b-9a7c-0d1e2f3a4b5c";

mock.module(`${src}/account/auth.ts`, () => ({
  userFor: async (headers: Headers) => ({ id: headers.get("x-user") ?? "user-a" }),
  toUser: (row: { id: string; email: string | null }) => ({
    via: "google",
    id: row.id,
    email: row.email,
    image: null,
  }),
}));
mock.module(`${src}/files/storage.ts`, () => ({
  storage: { bytes: async () => new TextEncoder().encode("salam") },
}));
mock.module(`${src}/files/store.ts`, () => ({
  fileId: { safeParse: (value: string) => ({ success: true, data: value }) },
  fileOf: async (id: string, by: string) =>
    id === fileA && by === "user-a"
      ? { key: "user-a/file", name: "notes.txt", mediaType: "text/plain" }
      : undefined,
  saveFile: async () => {
    throw new Error("an oversized upload must never be saved");
  },
  projectFileKeys: async () => [],
}));

const { uploadRoutes } = await import(`${src}/files/upload.ts`);

test("an upload over the limit with no content-length is refused before the body is read", async () => {
  const chunk = new Uint8Array(1024 * 1024);
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(chunk);
      if (pulled === 200) controller.close();
    },
  });
  const response = await uploadRoutes.fetch(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body,
      duplex: "half",
    }),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "That file is too large." });
  expect(pulled).toBeLessThan(20);
});

const get = (user: string) =>
  uploadRoutes.fetch(new Request(`http://localhost/${fileA}`, { headers: { "x-user": user } }));

test("a file is served to its owner and is a 404 for another user", async () => {
  const owner = await get("user-a");
  expect([owner.status, await owner.text()]).toEqual([200, "salam"]);
  const other = await get("user-b");
  expect([other.status, await other.json()]).toEqual([404, { error: "no such file" }]);
});

const id = "3f2b8c1e-5d4a-4e6b-9a7c-0d1e2f3a4b5c";

const library = [
  { name: "Tafsir notes.txt", size: 2_000, createdAt: 30, mediaType: "text/plain" },
  { name: "wudu.png", size: 900_000, createdAt: 10, mediaType: "image/png" },
  { name: "Fiqh of prayer.pdf", size: 4_000_000, createdAt: 20, mediaType: "application/pdf" },
  { name: "Prayer times.JPG", size: 300_000, createdAt: 40, mediaType: "image/jpeg" },
];

const view = {
  query: "",
  kinds: ["image", "pdf", "text"],
  sort: "created",
  descending: true,
} as const;

const sorted = (sort: "created" | "name" | "size", descending: boolean) =>
  shownFiles(library, { ...view, sort, descending }).map((file) => file.name);

const found = (query: string, kinds: ("image" | "pdf" | "text")[]) =>
  shownFiles(library, { ...view, query, kinds }).map((file) => file.name);

test("the library sorts by date, name or size in either direction", () => {
  expect(sorted("created", true)).toEqual([
    "Prayer times.JPG",
    "Tafsir notes.txt",
    "Fiqh of prayer.pdf",
    "wudu.png",
  ]);
  expect(sorted("name", false)).toEqual([
    "Fiqh of prayer.pdf",
    "Prayer times.JPG",
    "Tafsir notes.txt",
    "wudu.png",
  ]);
  expect(sorted("size", true)[0]).toBe("Fiqh of prayer.pdf");
});

test("search ignores case and a tab keeps only its kinds", () => {
  expect(found("PRAYER", ["image", "pdf", "text"])).toEqual([
    "Prayer times.JPG",
    "Fiqh of prayer.pdf",
  ]);
  expect(found("prayer", ["image"])).toEqual(["Prayer times.JPG"]);
  expect(found("", ["pdf", "text"])).toEqual(["Tafsir notes.txt", "Fiqh of prayer.pdf"]);
});

test("only our own download address names a file", () => {
  expect(fileIdOf(`https://sirathic.com/api/files/${id}`)).toBe(id);
  expect(fileIdOf(`http://localhost:3001/api/files/${id}`)).toBe(id);
  expect(fileIdOf(`/api/files/${id}`)).toBeUndefined();
  expect(fileIdOf(`https://sirathic.com/api/files/${id}/extra`)).toBeUndefined();
  expect(fileIdOf("data:image/png;base64,AAAA")).toBeUndefined();
});

test("sizes read in B, KB and MB", () => {
  expect([512, 2_048, 5_452_595].map(formatSize)).toEqual(["512 B", "2 KB", "5.2 MB"]);
});

const bytes = (...values: number[]) => new Uint8Array(values);

test("the type comes from the bytes, not from a name", () => {
  expect(
    [
      bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2),
      bytes(0xff, 0xd8, 0xff, 0xe0),
      bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61),
      bytes(0x52, 0x49, 0x46, 0x46, 9, 9, 9, 9, 0x57, 0x45, 0x42, 0x50),
      new TextEncoder().encode("%PDF-1.7 rest"),
      new TextEncoder().encode("Salam, what is zakat?"),
    ].map(mediaTypeOf),
  ).toEqual([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
  ]);
});

test("binary data that is no known type is refused", () => {
  expect(
    [bytes(0x4d, 0x5a, 0x90, 0x00, 0x03), bytes(0xc3, 0x28), bytes(0x68, 0x00, 0x69)].map(
      mediaTypeOf,
    ),
  ).toEqual([undefined, undefined, undefined]);
});
