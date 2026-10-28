import { tool } from "ai";
import { z } from "zod";
import { reasonOf } from "../http";
import { CONNECTORS, connectorId } from "./catalog";
import { connect, listConnections } from "./connections";

const MAX_RESULTS = 8;

const URL_OR_SECRET =
  /https?:\/\/\S+|\w*(?:token|secret|key|password|code)\w*\s*[=:]\s*\S+|[\w-]{32,}/giu;

export const notConnected = (err: Error) =>
  `Not connected: ${reasonOf(err)
    .replace(URL_OR_SECRET, "")
    .replace(/\s+/gu, " ")
    .replace(
      /[.\s]+$/u,
      "",
    )}. Tell the user it did not connect and why, in plain words. Do not say whose side failed or promise to retry.`;

type Listed = { id: string; name: string; category: string; connected: boolean };

export const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

export const matchingPlugins = (plugins: readonly Listed[], query: string | undefined) => {
  const wanted = wordsOf(query ?? "");
  return plugins
    .flatMap((plugin) => {
      const id = connectorId.safeParse(plugin.id).data;
      return id ? [{ plugin, description: CONNECTORS[id].description }] : [];
    })
    .map(({ plugin, description }) => {
      const haystack =
        `${plugin.id} ${plugin.name} ${plugin.category} ${description}`.toLowerCase();
      return { plugin, description, hits: wanted.filter((word) => haystack.includes(word)).length };
    })
    .filter(({ hits }) => wanted.length === 0 || hits > 0)
    .toSorted((a, b) => b.hits - a.hits || Number(b.plugin.connected) - Number(a.plugin.connected))
    .slice(0, wanted.length === 0 ? undefined : MAX_RESULTS)
    .map(({ plugin, description }) => ({
      id: plugin.id,
      name: plugin.name,
      does: description,
      installed: plugin.connected,
    }));
};

export function pluginTools(owner: string, returnTo: string) {
  return {
    search_plugins: tool({
      description:
        "Search the plugins the user could install (or already has): the apps and services Sirathic can connect to, like a calendar, notes or email. Results come back ranked by relevance, each with its id, install state and what it does. Use this to discover a capability you have no tool for, or to check whether a plugin is installed. Using an app the user has already connected needs no search. This is read-only and never needs the user's permission.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .optional()
          .describe(
            "Optional. What you're looking for, like calendar or notes. Results come back ranked by relevance. Omit to list the whole catalog.",
          ),
      }),
      execute: async ({ query }) => matchingPlugins(await listConnections(owner), query),
    }),
    install_plugin: tool({
      description:
        "Install a plugin by its id from search_plugins, when the user asks for it or their request needs it. If the plugin needs authentication, its connect card is shown to the user automatically, so don't describe it. Finish unrelated work, then end your turn. New tools become available on your next message.",
      inputSchema: z.object({ id: connectorId }),
      execute: async ({ id }) => ({
        id,
        name: CONNECTORS[id].name,
        ...(await connect(owner, id, returnTo).catch((err: Error) => {
          throw new Error(notConnected(err));
        })),
      }),
    }),
  };
}
