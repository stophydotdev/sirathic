import { z } from "zod";

export const settings = z
  .object({
    BROWSER_TOKEN: z.string().min(16),
    PORT: z.coerce.number().default(8080),
  })
  .parse(process.env);
