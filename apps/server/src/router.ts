import { accountRoutes } from "./account/routes";
import { automationRoutes } from "./automations/routes";
import { botRoutes } from "./bots/routes";
import { chatRoutes } from "./chat/routes";
import { fileRoutes } from "./files/routes";
import { pluginRoutes } from "./plugins/routes";
import { projectRoutes } from "./projects/routes";
import { skillRoutes } from "./skills/routes";
import { t } from "./trpc";

export const appRouter = t.router({
  ...chatRoutes,
  ...projectRoutes,
  ...botRoutes,
  ...automationRoutes,
  ...accountRoutes,
  ...pluginRoutes,
  ...skillRoutes,
  ...fileRoutes,
});

export type AppRouter = typeof appRouter;
