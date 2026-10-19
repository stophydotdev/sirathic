import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
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
