import { env } from "@sirathic/env/server";

const IV_BYTES = 12;

let key: Promise<CryptoKey> | undefined;

const tokenKey = () => {
  key ??= crypto.subtle.importKey(
    "raw",
    Uint8Array.from(Buffer.from(env.TOKEN_KEY, "base64")),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  return key;
};

export async function seal(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await tokenKey(),
    new TextEncoder().encode(plain),
  );
  return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(sealed).toString("base64url")}`;
}

export async function unseal(sealed: string) {
  const [iv = "", data = ""] = sealed.split(".");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Uint8Array.from(Buffer.from(iv, "base64url")) },
    await tokenKey(),
    Uint8Array.from(Buffer.from(data, "base64url")),
  );
  return new TextDecoder().decode(plain);
}
