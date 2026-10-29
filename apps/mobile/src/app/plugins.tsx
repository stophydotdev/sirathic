import { type Category, CONNECTORS } from "@sirathic/server/catalog";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useConfirm } from "@/components/confirm";
import { Check } from "@/components/icons";
import { EmptyBox, Page, Row, Tabs } from "@/components/page";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { pluginIcon } from "@/lib/sources";

type Plugin = Awaited<ReturnType<typeof api.connectors.list.query>>[number];
type Skill = Awaited<ReturnType<typeof api.skills.list.query>>[number];

const TABS = [
  ["plugins", "Plugins"],
  ["skills", "Skills"],
] as const;

const CATEGORY_NAMES = {
  productivity: "Productivity",
  automation: "Automation",
  search: "Search and data",
  developer: "Developer",
  analytics: "Analytics",
  finance: "Finance",
  marketing: "Marketing",
  sales: "Sales and support",
  social: "Social media",
  design: "Design and websites",
} satisfies Record<Category, string>;

const describe = (plugin: Plugin) =>
  plugin.category === "custom"
    ? (URL.parse(plugin.url)?.hostname ?? plugin.url)
    : CONNECTORS[plugin.id].description;

const Section = ({
  title,
  plugins,
  onAdd,
}: {
  title: string;
  plugins: Plugin[];
  onAdd: (plugin: Plugin) => void;
}) =>
  plugins.length === 0 ? null : (
    <View className="mb-6">
      <Text className="text-muted-foreground font-medium mb-1 text-sm">{title}</Text>
      {plugins.map((plugin) => (
        <Row key={plugin.id}>
          <Image
            source={{ uri: pluginIcon(plugin.url) }}
            className="bg-muted size-7 rounded-full"
          />
          <View className="flex-1">
            <Text numberOfLines={1} className="text-foreground font-medium text-sm">
              {plugin.name}
            </Text>
            <Text numberOfLines={1} className="text-muted-foreground font-sans text-xs">
              {describe(plugin)}
            </Text>
          </View>
          {plugin.connected ? (
            <Check size={20} strokeWidth={1.75} colorClassName="accent-super" />
          ) : (
            <Pressable
              onPress={() => onAdd(plugin)}
              className="bg-foreground active:opacity-85 h-7 items-center justify-center rounded-full px-3"
            >
              <Text className="text-background font-medium text-sm">Add</Text>
            </Pressable>
          )}
        </Row>
      ))}
    </View>
  );

export default function Plugins() {
  const signedIn = authClient.useSession().data !== null;
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("plugins");
  const [plugins, setPlugins] = useState<Plugin[]>();
  const [skills, setSkills] = useState<Skill[]>();

  const load = useCallback(() => {
    void api.connectors.list.query().then(setPlugins, () => setPlugins([]));
    void api.skills.list.query().then(setSkills, () => setSkills([]));
  }, []);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  const connect = async (plugin: Plugin) => {
    const result = await api.connectors.connect.mutate({ id: plugin.id }).catch(() => undefined);
    if (result?.status === "redirect") await WebBrowser.openBrowserAsync(result.url);
    load();
  };

  const ask = (plugin: Plugin) =>
    useConfirm.getState().ask({
      title: `Connect ${plugin.name}?`,
      body: "Plugins are made by other companies, not Sirathic. Check what a plugin can see before you connect it.",
      action: "Connect",
      onConfirm: () => void connect(plugin),
    });

  const sorted = [...(plugins ?? [])];
  sorted.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Page title="Plugins">
      <Tabs tabs={TABS} tab={tab} onChange={setTab} />
      {!signedIn ? (
        <EmptyBox title="Sign in to add plugins." signIn />
      ) : tab === "plugins" ? (
        <>
          <Section
            title="Popular"
            plugins={sorted.filter((plugin) => plugin.popular)}
            onAdd={ask}
          />
          <Section
            title="Your plugins"
            plugins={sorted.filter((plugin) => plugin.category === "custom")}
            onAdd={ask}
          />
          {Object.entries(CATEGORY_NAMES).map(([category, name]) => (
            <Section
              key={category}
              title={name}
              plugins={sorted.filter((plugin) => !plugin.popular && plugin.category === category)}
              onAdd={ask}
            />
          ))}
        </>
      ) : skills?.length === 0 ? (
        <EmptyBox title="No skills yet" hint="Ask Sirathic to save a skill in any chat." />
      ) : (
        skills?.map((skill) => (
          <Row key={skill.name}>
            <View className="flex-1">
              <Text className="text-foreground font-medium text-sm">{skill.name}</Text>
              <Text numberOfLines={2} className="text-muted-foreground font-sans text-xs">
                {skill.instructions}
              </Text>
            </View>
          </Row>
        ))
      )}
    </Page>
  );
}
