import { z } from "zod";

export const outgoingEmail = z.object({
  to: z.array(z.email()).min(1),
  cc: z.array(z.email()).optional(),
  bcc: z.array(z.email()).optional(),
  subject: z.string().max(500),
  body: z.string(),
});

export const emailEditKey = (owner: string, toolCallId: string) =>
  `emailEdit:${owner}:${toolCallId}`;
