import { Stophy } from "stophy";
import { env } from "@sirathic/env/server";

let client: Stophy | null = null;

export const getStophy = (): Stophy => {
  if (!env.STOPHY_API_KEY) {
    throw new Error("STOPHY_API_KEY is not set");
  }

  if (!client) {
    client = new Stophy({ apiKey: env.STOPHY_API_KEY });
  }

  return client;
};

export const isYoutubeUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "music.youtube.com"
    );
  } catch {
    return false;
  }
};
