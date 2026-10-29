import { tool } from "ai";
import { searchX, xSearchInput } from "../models/plans";
import type { Cite } from "./cite";
import { fenced } from "./fence";

const POSTER = /^https:\/\/(?:x|twitter)\.com\/(\w+)\/status\//u;

const postTitle = (url: string) => {
  const poster = POSTER.exec(url)?.[1];
  return poster && poster !== "i" ? `@${poster} on X` : "Post on X";
};

export const xSearchTools = (owner: string, cite: Cite) => ({
  search_x: tool({
    description:
      "Search X (Twitter) posts, profiles and threads through the user's Grok plan. Read-only discovery only: use this for current discussion, reactions, or claims on public X rather than general web pages. Do not use it to post, reply, like, DM, upload media or delete.",
    inputSchema: xSearchInput,
    execute: async (input) => {
      const { answer, posts } = await searchX(owner, input);
      return {
        answer,
        posts: posts.map((url) => ({ citation: cite(url), url })),
        sources: posts.map((url) => ({ url, title: postTitle(url), snippet: "" })),
      };
    },
    toModelOutput: ({ output: { answer, posts } }) =>
      fenced({ type: "json", value: { answer, posts } }),
  }),
});
