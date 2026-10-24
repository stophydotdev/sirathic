import type { AppRouter } from "@sirathic/server/router";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export const api = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/trpc" })],
});
