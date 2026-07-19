import { publicProcedure, router } from "../index";
import { suggestionsRouter } from "./suggestions";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  suggestions: suggestionsRouter,
});

export type AppRouter = typeof appRouter;
