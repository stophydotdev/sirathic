import { env } from "@sirathic/env/server";
import { Stophy } from "stophy";

export const stophy = new Stophy({ apiKey: env.STOPHY_API_KEY });

export const clip = (text: string | null | undefined, chars: number) =>
  (text ?? "").replaceAll(/\s+/gu, " ").trim().slice(0, chars);
