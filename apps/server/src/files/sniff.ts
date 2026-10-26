const startsWith = (bytes: Uint8Array, signature: (number | null)[]) =>
  bytes.length >= signature.length &&
  signature.every((byte, index) => byte === null || bytes[index] === byte);

const SIGNATURES = [
  { mediaType: "image/png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mediaType: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { mediaType: "image/gif", signature: [0x47, 0x49, 0x46, 0x38] },
  {
    mediaType: "image/webp",
    signature: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
  { mediaType: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

const utf8 = new TextDecoder("utf-8", { fatal: true });

const isText = (bytes: Uint8Array) => {
  try {
    return !utf8.decode(bytes).includes("\u0000");
  } catch {
    return false;
  }
};

export const mediaTypeOf = (bytes: Uint8Array) =>
  SIGNATURES.find(({ signature }) => startsWith(bytes, signature))?.mediaType ??
  (isText(bytes) ? "text/plain" : undefined);
