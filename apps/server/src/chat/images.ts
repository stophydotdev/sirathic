import { imageSearch } from "@sirathic/core/tools/imageSearch";
import { tool } from "ai";
import { z } from "zod";
import { fenced } from "./fence";

const IMAGES_PER_SEARCH = 6;

export const imageTools = (addImage: (image: { url: string; title: string }) => number) => ({
  search_images: tool({
    description: `Searches the web for images of a visual subject, like a mosque, a manuscript, a place or a plant, and returns them as [image:x] tokens.

[image:x] is a visual placeholder, not a citation.

Use only the provided [image:x] tokens. Put each image token on its own line in the relevant section. Do not use image URLs, Markdown image syntax, captions, or an Images/Gallery/Visuals section.

Include images only when they clearly help the user understand a visual subject, distinguish entities, or answer an image-focused request. Skip images for abstract topics, tutorials, data/interface visuals, disturbing content, or decoration. Never show images of the Prophet ﷺ, the prophets or the Companions.

Never invent images, reuse the same image, or derive factual claims from images. Support factual claims with text sources or other source artifacts instead.`,
    inputSchema: z.object({
      query: z.string().trim().min(2).max(200).describe("What the images should show."),
    }),
    execute: async ({ query }) => {
      const found = await imageSearch({ query, limit: IMAGES_PER_SEARCH });
      return found.map(
        ({ thumbnailUrl, title = query, source = "" }) =>
          `[image:${addImage({ url: thumbnailUrl, title })}] ${title} (${source})`,
      );
    },
    toModelOutput: ({ output }) =>
      fenced({ type: "text", value: output.join("\n") || "No images." }),
  }),
});
