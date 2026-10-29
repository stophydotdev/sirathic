import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { z } from "zod";

export const API_URL = z.url().parse(process.env.EXPO_PUBLIC_API_URL);

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "sirathic",
      storagePrefix: "sirathic",
      cookiePrefix: "sirathic",
      storage: SecureStore,
    }),
  ],
});

export const sessionHeaders = async () => ({
  cookie: await authClient.getCookie(),
});

const downloads = new Map<string, Promise<string>>();

const downloaded = (uri: string) => {
  const started = downloads.get(uri);
  if (started) return started;
  const target = new File(Paths.cache, `signed-${uri.split("/").pop() ?? "file"}`);
  const download = sessionHeaders()
    .then((headers) => File.downloadFileAsync(uri, target, { headers, idempotent: true }))
    .then((file) => file.uri);
  downloads.set(uri, download);
  download.catch(() => downloads.delete(uri));
  return download;
};

export const useSignedUri = (uri: string) => {
  const signed = uri.startsWith(API_URL);
  const [local, setLocal] = useState<string>();
  useEffect(() => {
    if (!signed) return;
    let current = true;
    void downloaded(uri).then(
      (file) => {
        if (current) setLocal(file);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [uri, signed]);
  return signed ? local : uri;
};
