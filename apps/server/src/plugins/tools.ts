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

const wordsOf = (text: string) =>
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
        "Searches or lists the plugin catalog, the apps and services Sirathic can connect to, like a calendar, notes or email. Returns each plugin with its id, what it does and whether the user already has it installed. Use it when the user asks for a capability you have no tool for, whether a plugin exists, or what they can connect.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .optional()
          .describe(
            "What the user wants to do, like calendar or notes. Leave it out to list every plugin, installed first, such as when they ask what you can connect to or what is installed.",
          ),
      }),
      execute: async ({ query }) => matchingPlugins(await listConnections(owner), query),
    }),
    install_plugin: tool({
      description:
        "Installs a plugin from the catalog by its id from search_plugins, when the user asks for it or their request needs it. Say in one line what the plugin could read, like their calendar or notes. Most plugins then need the user to sign in on the card that follows, so tell them to finish there and that the plugin's tools arrive on their next message.",
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
