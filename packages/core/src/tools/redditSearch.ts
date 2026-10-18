import { z } from "zod";
import { clip, stophy } from "../stophy";

const TEXT_CHARS = 400;

export const redditSearchInput = z.object({
  query: z.string().trim().min(2).max(200),
  subreddit: z
    .string()
    .trim()
    .regex(/^\w{2,30}$/u)
    .optional()
    .describe("Only this subreddit, without r/, like islam or MuslimLounge"),
  time: z.enum(["pastWeek", "pastMonth", "pastYear", "allTime"]).optional(),
  limit: z.number().int().min(1).max(10).default(6),
});

export const redditSearch = async (
  input: z.input<typeof redditSearchInput>,
) => {
  const { query, subreddit, time, limit } = redditSearchInput.parse(input);
  const { data } = await stophy.reddit.search({ query, subreddit, time });
  const posts = data.results.flatMap((post) =>
    post.type === "post" && post.postUrl
      ? [
          {
            url: post.postUrl,
            title: post.title ?? "",
            description: clip(post.text, TEXT_CHARS),
            subreddit: post.subreddit ?? null,
            score: post.score ?? null,
            comments: post.comments ?? null,
            publishedAt: post.publishedAt ?? null,
          },
        ]
      : [],
  );
  return { query, posts: posts.slice(0, limit) };
};
