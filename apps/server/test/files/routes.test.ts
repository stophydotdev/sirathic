import { expect, mock, test } from "bun:test";

const src = `${import.meta.dir}/../../src`;
const fileA = "3f2b8c1e-5d4a-4e6b-9a7c-0d1e2f3a4b5c";

mock.module(`${src}/auth.ts`, () => ({
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

const { filesRoutes } = await import(`${src}/files/routes.ts`);

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
  const response = await filesRoutes.fetch(
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
  filesRoutes.fetch(new Request(`http://localhost/${fileA}`, { headers: { "x-user": user } }));

test("a file is served to its owner and is a 404 for another user", async () => {
  const owner = await get("user-a");
  expect([owner.status, await owner.text()]).toEqual([200, "salam"]);
  const other = await get("user-b");
  expect([other.status, await other.json()]).toEqual([404, { error: "no such file" }]);
});
