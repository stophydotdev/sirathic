import { createHmac } from "node:crypto";
import { z } from "zod";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export const setupKey = z
  .string()
  .trim()
  .transform((key) => key.replaceAll(/[\s=-]/gu, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z2-7]{16,128}$/u, "a setup key of letters A to Z and digits 2 to 7"));

const bytesOf = (key: string) => {
  const bits = [...key].map((char) => ALPHABET.indexOf(char).toString(2).padStart(5, "0")).join("");
  return Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, index) =>
      Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2),
    ),
  );
};

export const totp = (key: string, at = Date.now()) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1_000 / STEP_SECONDS)));
  const hash = createHmac("sha1", bytesOf(key)).update(counter).digest();
  const offset = (hash.at(-1) ?? 0) & 0x0f;
  return String((hash.readUInt32BE(offset) & 0x7f_ff_ff_ff) % 10 ** DIGITS).padStart(DIGITS, "0");
};
