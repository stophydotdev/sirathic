import { tool } from "ai";
import { z } from "zod";
import { CONNECTORS, connectorId } from "./catalog";
import { connect, listConnections } from "./connections";

const MAX_RESULTS = 8;

type Listed = { id: string; name: string; category: string; connected: boolean };

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

export const matchingPlugins = (plugins: readonly Listed[], query: string) => {
  const wanted = wordsOf(query);
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
    .filter(({ hits }) => hits > 0)
    .toSorted((a, b) => b.hits - a.hits)
    .slice(0, MAX_RESULTS)
    .map(({ plugin, description }) => ({
      id: plugin.id,
      name: plugin.name,
      does: description,
      installed: plugin.connected,
    }));
};

export function pluginTools(owner: string) {
  return {
    search_plugins: tool({
      description:
        "Searches the plugin catalog, the apps and services Sirathic can connect to, like a calendar, notes or email. Returns each match with its id, what it does and whether the user already has it installed. Use it when the user asks for a capability you have no tool for, or whether a plugin exists.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .describe("What the user wants to do, like calendar or notes"),
      }),
      execute: async ({ query }) => matchingPlugins(await listConnections(owner), query),
    }),
    install_plugin: tool({
      description:
        "Starts installing a plugin from the catalog by its id from search_plugins. Call it only when the user asked for the plugin or said yes to your offer, never on your own. Before you ask, say in one line what the plugin could read, like their calendar or notes. The user confirms on a card first. Most plugins then need the user to sign in: they get a Connect card with the link, so tell them to finish there and that the plugin's tools arrive on their next message.",
      inputSchema: z.object({ id: connectorId }),
      execute: async ({ id }) => ({ id, name: CONNECTORS[id].name, ...(await connect(owner, id)) }),
    }),
  };
}
