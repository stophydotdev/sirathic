import { z } from "zod";
import { clip, stophy } from "../stophy";

const POST_CHARS = 3000;
const COMMENT_CHARS = 600;
const COMMENTS = 15;
const GONE = new Set(["[deleted]", "[removed]"]);

export const redditThreadInput = z.object({
  postUrl: z.url().describe("A Reddit post link, usually from redditSearch"),
});

export const redditThread = async (input: z.input<typeof redditThreadInput>) => {
  const { postUrl } = redditThreadInput.parse(input);
  const { data } = await stophy.reddit.post({ postUrl });
  const comments = data.results.flatMap((comment) =>
    comment.text && !GONE.has(comment.text.trim())
      ? [
          {
            text: clip(comment.text, COMMENT_CHARS),
            score: comment.score ?? null,
            depth: comment.depth ?? 0,
            byPoster: comment.isSubmitter ?? false,
          },
        ]
      : [],
  );
  return {
    url: data.postUrl ?? postUrl,
    title: data.title ?? "",
    text: clip(data.text, POST_CHARS),
    subreddit: data.subreddit ?? null,
    score: data.score ?? null,
    comments: comments.slice(0, COMMENTS),
  };
};
