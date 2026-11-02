import { z } from "zod";
import { StatusError } from "../http";

const uniqueViolation = z.object({ cause: z.object({ code: z.literal("23505") }) });

export const refuseTaken = (message: string) => (error: Error) => {
  if (uniqueViolation.safeParse(error).success) throw new StatusError(409, message);
  throw error;
};
