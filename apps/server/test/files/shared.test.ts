import { expect, test } from "bun:test";
import { fileIdOf, formatSize, shownFiles } from "../../src/shared/files";

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
