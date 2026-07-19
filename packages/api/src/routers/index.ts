import { publicProcedure, router } from "../index";
import { suggestionsRouter } from "./suggestions";
import { videosRouter } from "./videos";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  suggestions: suggestionsRouter,
  videos: videosRouter,
});

export type AppRouter = typeof appRouter;
