import type { AppRouter } from "@sirathic/server/router";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { API_URL, sessionHeaders } from "./auth";

export const api = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: `${API_URL}/trpc`, headers: sessionHeaders })],
});
