import { accountRoutes } from "./account/routes";
import { automationRoutes } from "./automations/routes";
import { botRoutes } from "./bots/routes";
import { chatRoutes } from "./chat/routes";
import { fileRoutes } from "./files/routes";
import { emailRoutes } from "./plugins/emailRoutes";
import { pluginRoutes } from "./plugins/routes";
import { shopRoutes } from "./chat/shopRoutes";
import { projectRoutes } from "./projects/routes";
import { skillRoutes } from "./skills/routes";
import { t } from "./trpc";
import { vaultRoutes } from "./vault/routes";

export const appRouter = t.router({
  ...chatRoutes,
  ...projectRoutes,
  ...botRoutes,
  ...automationRoutes,
  ...accountRoutes,
  ...pluginRoutes,
  ...emailRoutes,
  ...skillRoutes,
  ...fileRoutes,
  ...vaultRoutes,
  ...shopRoutes,
});

export type AppRouter = typeof appRouter;
