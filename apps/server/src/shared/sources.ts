import { z } from "zod";

export const sourceVideo = z.object({
  channel: z.string(),
  thumbnail: z.string().optional(),
  seconds: z.number().optional(),
  published: z.string().optional(),
  views: z.number().optional(),
});

export const source = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  credit: z.string().optional(),
  video: sourceVideo.optional(),
});

export type Source = z.infer<typeof source>;

export const videoLength = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = String(Math.floor(seconds % 60)).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
};
