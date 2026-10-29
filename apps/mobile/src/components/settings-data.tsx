import type { Settings } from "@sirathic/server/settings";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { type FC, useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { api } from "@/lib/api";
import { useChatState } from "@/lib/chat-state";
import { usePreferences } from "@/lib/preferences";
import { useConfirm } from "./confirm";
import { X } from "./icons";
import { ActionButton, Group, Setting, Toggle } from "./settings-controls";

type Memory = Pick<Settings, "saveMemory" | "usePastChats" | "memory">;

const SITE = "https://sirathic.com";

const MemoryFacts: FC<{ memory: readonly string[]; onChange: (next: string[]) => void }> = ({
  memory,
  onChange,
}) => (
  <Group title="Memory from your chats">
    {memory.length === 0 ? (
      <Text className="text-muted-foreground font-sans py-2 text-xs">
        Facts Sirathic saved to answer you better
      </Text>
    ) : (
      memory.map((fact, index) => (
        <View key={fact} className="flex-row items-start gap-3 py-2">
          <Text className="text-foreground flex-1 font-sans text-sm">{fact}</Text>
          <Pressable
            accessibilityLabel="Delete"
            onPress={() => onChange(memory.filter((_, at) => at !== index))}
            className="active:bg-muted size-7 items-center justify-center rounded-md"
          >
            <X size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
          </Pressable>
        </View>
      ))
    )}
    {memory.length > 0 && (
      <Setting label="Delete all">
        <ActionButton
          label="Delete all"
          danger
          onPress={() =>
            useConfirm.getState().ask({
              title: "Delete everything Sirathic remembers? This can't be undone.",
              action: "Delete all",
              danger: true,
              onConfirm: () => onChange([]),
            })
          }
        />
      </Setting>
    )}
  </Group>
);

export const DataSection: FC = () => {
  const signedIn = useChatState((s) => s.account?.signedIn === true);
  const [saved, setSaved] = useState<Memory>();
  const incognitoByDefault = usePreferences((s) => s.incognitoByDefault);
  const changePreferences = usePreferences((s) => s.change);

  useEffect(() => {
    if (!signedIn) return;
    void api.settings.get.query().then(
      ({ saveMemory, usePastChats, memory }) => setSaved({ saveMemory, usePastChats, memory }),
      () => undefined,
    );
  }, [signedIn]);

  const save = (update: Partial<Memory>) => {
    setSaved((current) => current && { ...current, ...update });
    void api.settings.update.mutate(update).catch(() => undefined);
  };

  const incognitoRow = (
    <Setting label="Incognito by default" hint="New chats start in incognito and aren't saved">
      <Toggle
        value={incognitoByDefault}
        onChange={(on) => {
          changePreferences({ incognitoByDefault: on });
          useChatState.getState().setIncognito(on);
        }}
      />
    </Setting>
  );

  if (!signedIn) return <Group>{incognitoRow}</Group>;

  return (
    <>
      {saved && (
        <>
          <Group>
            {incognitoRow}
            <Setting
              label="Save new memories"
              hint="Sirathic keeps facts from your chats to answer you better"
            >
              <Toggle value={saved.saveMemory} onChange={(saveMemory) => save({ saveMemory })} />
            </Setting>
            <Setting
              label="Use past chats"
              hint="Sirathic can look through your earlier chats when it helps"
            >
              <Toggle
                value={saved.usePastChats}
                onChange={(usePastChats) => save({ usePastChats })}
              />
            </Setting>
          </Group>
          <MemoryFacts memory={saved.memory} onChange={(memory) => save({ memory })} />
        </>
      )}
      <Group>
        <Setting label="Delete all chats" hint="Removes every saved chat">
          <ActionButton
            label="Delete all"
            danger
            onPress={() =>
              useConfirm.getState().ask({
                title: "Delete every saved chat? This can't be undone.",
                action: "Delete all",
                danger: true,
                onConfirm: () =>
                  void api.sessions.removeAll.mutate().then(
                    () => {
                      const { newChat, loadSessions } = useChatState.getState();
                      newChat();
                      return loadSessions();
                    },
                    () => undefined,
                  ),
              })
            }
          />
        </Setting>
      </Group>
    </>
  );
};

export const AboutSection: FC = () => (
  <Group>
    <Setting label="Terms">
      <ActionButton
        label="Open"
        onPress={() => void WebBrowser.openBrowserAsync(`${SITE}/terms`)}
      />
    </Setting>
    <Setting label="Privacy">
      <ActionButton
        label="Open"
        onPress={() => void WebBrowser.openBrowserAsync(`${SITE}/privacy`)}
      />
    </Setting>
    <Setting label="Contact" hint="Report a wrong answer or a bug">
      <ActionButton
        label="Email us"
        onPress={() => void Linking.openURL("mailto:hussein@sirathic.com")}
      />
    </Setting>
    <Setting label="Version" hint={Constants.expoConfig?.version} />
  </Group>
);
