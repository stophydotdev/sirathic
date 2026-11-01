import { imageSearch } from "@sirathic/core/tools/imageSearch";
import { tool } from "ai";
import { z } from "zod";
import { yesChances } from "./clef";
import { fenced } from "./fence";

const IMAGES_PER_SEARCH = 6;
const FIGURE_CUTOFF = 0.1;
const THUMBNAIL_WAIT_MS = 5_000;
const THUMBNAIL_MAX_BYTES = 4 * 1024 * 1024;
const CLEF_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const HOLY_FIGURE =
  "Does this image show a human figure that stands for a prophet, the Prophet Muhammad, one of his Companions or family, or another religious figure from Islamic or biblical history? Count paintings, drawings, cartoons, statues and film stills, and figures whose face is hidden, blurred, veiled or glowing. Photos of today's pilgrims or crowds, calligraphy, buildings and landscapes do not count.";
const HOLY_TITLE =
  "Does the image's title say the picture shows a prophet, the Prophet Muhammad, one of his Companions or family, or a scene from their stories with people in it? A title about a mosque, shrine, grave, place, book, calligraphy or a name written in Arabic does not count.";

const showable = async ({ thumbnailUrl, title = "" }: { thumbnailUrl: string; title?: string }) => {
  const response = await fetch(thumbnailUrl, {
    signal: AbortSignal.timeout(THUMBNAIL_WAIT_MS),
  }).catch(() => undefined);
  const type = response?.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const size = Number(response?.headers.get("content-length") ?? 0);
  if (!response?.ok || !CLEF_IMAGE_TYPES.has(type) || size > THUMBNAIL_MAX_BYTES) return false;
  const body = await response.arrayBuffer().catch(() => undefined);
  if (!body || body.byteLength > THUMBNAIL_MAX_BYTES) return false;
  const bytes = Buffer.from(body);
  const chance = await yesChances(
    `The image above came from a web image search. Its title: ${title}`,
    { figure: HOLY_FIGURE, title: HOLY_TITLE },
    "clef",
    [`data:${type};base64,${bytes.toString("base64")}`],
  ).catch(() => undefined);
  const figure = chance?.("figure");
  const named = chance?.("title");
  return figure !== undefined && named !== undefined && Math.max(figure, named) < FIGURE_CUTOFF;
};

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
      const kept = await Promise.all(found.map(showable));
      return found
        .filter((_, at) => kept[at])
        .map(
          ({ thumbnailUrl, title = query, source = "" }) =>
            `[image:${addImage({ url: thumbnailUrl, title })}] ${title} (${source})`,
        );
    },
    toModelOutput: ({ output }) =>
      fenced({ type: "text", value: output.join("\n") || "No images." }),
  }),
});
