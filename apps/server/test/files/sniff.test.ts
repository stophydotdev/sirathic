import { expect, test } from "bun:test";
import { mediaTypeOf } from "../../src/files/sniff";

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
