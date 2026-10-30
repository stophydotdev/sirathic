import { expect, mock, test } from "bun:test";
import { z } from "zod";
import { fileIdOf, formatSize, shownFiles } from "../apps/server/src/shared/files";
import { strToU8, zipSync } from "fflate";
import { docxText } from "../apps/server/src/files/docx";
import { mediaTypeOf } from "../apps/server/src/files/sniff";
import { closable, IDLE_MS, MAKE_ROOM_IDLE_MS } from "../apps/browser/src/idle";
import { codeSandbox } from "../apps/server/src/chat/codeTools";

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
const saved: { by: string; name: string; mediaType: string; text: string }[] = [];
mock.module(`${src}/files/store.ts`, () => ({
  fileId: { safeParse: (value: string) => ({ success: true, data: value }) },
  fileName: z.string(),
  fileOf: async (id: string, by: string) =>
    id === fileA && by === "user-a"
      ? { key: "user-a/file", name: "notes.txt", mediaType: "text/plain" }
      : undefined,
  saveFile: async (by: string, upload: { name: string; mediaType: string; bytes: Uint8Array }) => {
    saved.push({
      by,
      name: upload.name,
      mediaType: upload.mediaType,
      text: new TextDecoder().decode(upload.bytes),
    });
    return {
      id: fileA,
      name: upload.name,
      mediaType: upload.mediaType,
      size: upload.bytes.length,
      createdAt: 0,
    };
  },
}));

const { uploadRoutes } = await import(`${src}/files/upload.ts`);
const { fileTools } = await import(`${src}/chat/fileTools.ts`);
const { citations } = await import(`${src}/chat/citations.ts`);

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
  expect(saved).toEqual([]);
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

const word = (body: string) =>
  zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8(`<w:document><w:body>${body}</w:body></w:document>`),
  });

test("a Word document is known by its bytes, and its text reads as paragraphs", () => {
  const docx = word(
    '<w:p><w:r><w:t>Zakat &amp; sadaqah</w:t></w:r></w:p><w:p><w:pPr><w:tabs><w:tab w:val="left"/></w:tabs></w:pPr><w:r><w:t>Nisab</w:t><w:tab/><w:t xml:space="preserve">85 g</w:t><w:delText>87 g</w:delText></w:r></w:p>',
  );
  expect([docx, zipSync({ "notes.txt": strToU8("hi") })].map(mediaTypeOf)).toEqual([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    undefined,
  ]);
  expect(docxText(docx)).toBe("Zakat & sadaqah\nNisab\t85 g");
});

test("binary data that is no known type is refused", () => {
  expect(
    [bytes(0x4d, 0x5a, 0x90, 0x00, 0x03), bytes(0xc3, 0x28), bytes(0x68, 0x00, 0x69)].map(
      mediaTypeOf,
    ),
  ).toEqual([undefined, undefined, undefined]);
});

const call = { toolCallId: "call", messages: [] };

const asked = {
  owner: "user-a",
  incognito: false,
  research: false,
  sandbox: undefined,
  link: (text: string) => text,
};

test("a text file the model writes is saved to the library under its name", async () => {
  saved.length = 0;
  const tools = fileTools(asked);
  const result = await tools.create_text_file.execute?.(
    { name: "study-plan.md", content: "# Week 1\nLearn Ar-Rahman." },
    call,
  );
  expect(saved).toEqual([
    {
      by: "user-a",
      name: "study-plan.md",
      mediaType: "text/plain",
      text: "# Week 1\nLearn Ar-Rahman.",
    },
  ]);
  expect(result).toMatchObject({ files: [{ name: "study-plan.md", mediaType: "text/plain" }] });
});

test("a research report links its [n] numbers to the sources found in the chat", async () => {
  saved.length = 0;
  const sources = citations([]);
  sources.add("https://islamqa.info/en/answers/1");
  const tools = fileTools({ ...asked, research: true, link: sources.link });
  await tools.create_research_report?.execute?.(
    { title: "Zakat on gold", content: "Gold jewelry is zakatable [1]." },
    call,
  );
  expect(saved.map(({ text }) => text)).toEqual([
    "Gold jewelry is zakatable [1](https://islamqa.info/en/answers/1).",
  ]);
});

test("an incognito chat saves no file and tells the model why", async () => {
  saved.length = 0;
  const tools = fileTools({ ...asked, incognito: true });
  const attempt = tools.create_text_file.execute?.({ name: "plan.txt", content: "x" }, call);
  await expect(attempt).rejects.toThrow("this chat is incognito");
  expect(saved).toEqual([]);
});

const ranWith = (files: Record<string, Uint8Array>) => async () => ({
  stdout: "done",
  stderr: "",
  exitCode: 0,
  kept: [],
  removed: [],
  files: Object.entries(files).map(([name, content]) => ({ name, bytes: content })),
});

const names = (options: { research?: boolean; sandbox?: ReturnType<typeof ranWith> }) =>
  Object.keys(fileTools({ ...asked, ...options }));

test("Research offers the report tool and the sandbox offers code_execution", () => {
  expect(names({})).toEqual(["create_text_file"]);
  expect(names({ research: true })).toEqual(["create_text_file", "create_research_report"]);
  expect(names({ sandbox: ranWith({}) })).toEqual(["create_text_file", "code_execution"]);
});

const runWith = (files: Record<string, Uint8Array>, incognito = false) =>
  fileTools({ ...asked, incognito, sandbox: ranWith(files) }).code_execution.execute?.(
    { code: "print(1)" },
    call,
  );

test("code_execution saves every file the script wrote to the Library", async () => {
  saved.length = 0;
  const result = await runWith({ "zakat.csv": new TextEncoder().encode("5000,0.00") });
  expect(saved).toEqual([
    { by: "user-a", name: "zakat.csv", mediaType: "text/plain", text: "5000,0.00" },
  ]);
  expect(result).toMatchObject({ stdout: "done", files: [{ name: "zakat.csv" }], errors: [] });
});

test("code_execution keeps no file over the size limit and says why", async () => {
  saved.length = 0;
  const result = await runWith({ "big.csv": new Uint8Array(11 * 1024 * 1024) });
  expect(saved).toEqual([]);
  expect(result).toMatchObject({
    files: [],
    errors: ["big.csv must be between 1 byte and 10.0 MB."],
  });
});

test("an incognito chat runs code but keeps none of its files", async () => {
  saved.length = 0;
  const result = await runWith({ "zakat.csv": new TextEncoder().encode("5000,0.00") }, true);
  expect(saved).toEqual([]);
  expect(result).toMatchObject({
    stdout: "done",
    files: [],
    errors: [expect.stringContaining("this chat is incognito")],
  });
});

const encoded = (text: string) => Buffer.from(text).toString("base64");

test("the sandbox gets the bot's files and keeps what the script changed", async () => {
  const real = globalThis.fetch;
  const sent: unknown[] = [];
  globalThis.fetch = Object.assign(
    async (_input: string | Request | URL, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({
        stdout: "125",
        stderr: "",
        exitCode: 0,
        files: [{ name: "zakat.csv", data: encoded("5000,0.00") }],
        changed: [{ name: "ticket.txt", data: encoded("stamped") }],
        removed: ["old.txt"],
      });
    },
    { preconnect: real.preconnect },
  );
  const held = new Map([
    ["ticket.txt", "plain"],
    ["old.txt", "x"],
  ]);
  const disk = {
    list: async () => [...held.keys()].map((name) => ({ name, size: 1 })),
    read: async (name: string) => new TextEncoder().encode(held.get(name)),
    write: async (name: string, content: Uint8Array) => {
      held.set(name, new TextDecoder().decode(content));
      return name;
    },
    remove: async (name: string) => {
      held.delete(name);
    },
    clear: async () => held.clear(),
  };
  const ran = await codeSandbox("bot-1", disk)("print(5000 * 0.025)", undefined);
  globalThis.fetch = real;
  expect(sent).toEqual([
    {
      session: "bot-1",
      code: "print(5000 * 0.025)",
      files: [
        { name: "ticket.txt", data: encoded("plain") },
        { name: "old.txt", data: encoded("x") },
      ],
    },
  ]);
  expect(ran.files.map((file) => [file.name, new TextDecoder().decode(file.bytes)])).toEqual([
    ["zakat.csv", "5000,0.00"],
  ]);
  expect([ran.kept, ran.removed]).toEqual([["ticket.txt"], ["old.txt"]]);
  expect([...held]).toEqual([["ticket.txt", "stamped"]]);
});

test("two code runs in one bot turn take turns, so neither loses the other's change", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async (_input: string | Request | URL, init?: RequestInit) => {
      const { files } = z
        .object({ files: z.array(z.object({ name: z.string(), data: z.string() })) })
        .parse(JSON.parse(String(init?.body)));
      const count = Number(Buffer.from(files[0]?.data ?? "", "base64").toString());
      return Response.json({
        stdout: "",
        stderr: "",
        exitCode: 0,
        files: [],
        changed: [{ name: "count.txt", data: encoded(String(count + 1)) }],
        removed: [],
      });
    },
    { preconnect: real.preconnect },
  );
  let held = "0";
  const disk = {
    list: async () => [{ name: "count.txt", size: 1 }],
    read: async () => new TextEncoder().encode(held),
    write: async (name: string, content: Uint8Array) => {
      held = new TextDecoder().decode(content);
      return name;
    },
    remove: async () => undefined,
    clear: async () => undefined,
  };
  const run = codeSandbox("bot-1", disk);
  await Promise.all([run("add one", undefined), run("add one", undefined)]);
  globalThis.fetch = real;
  expect(held).toBe("2");
});

test("a bot's browser closes when idle, never while someone uses it or a form waits", () => {
  const now = 10 * 60 * 60_000;
  const idle = { controllers: 0, holdUntil: 0, lastUsed: now - IDLE_MS };
  expect(closable(idle, now, IDLE_MS)).toBe(true);
  expect(closable({ ...idle, lastUsed: now - IDLE_MS + 1 }, now, IDLE_MS)).toBe(false);
  expect(closable({ ...idle, controllers: 1 }, now, IDLE_MS)).toBe(false);
  expect(closable({ ...idle, holdUntil: now + 1 }, now, IDLE_MS)).toBe(false);
  const quiet = { ...idle, lastUsed: now - MAKE_ROOM_IDLE_MS };
  expect(closable(quiet, now, IDLE_MS)).toBe(false);
  expect(closable(quiet, now, MAKE_ROOM_IDLE_MS)).toBe(true);
});
