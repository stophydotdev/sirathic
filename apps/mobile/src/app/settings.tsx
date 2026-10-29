import { useFocusEffect } from "expo-router";
import { type FC, useCallback, useState } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import {
  Adjustments,
  ChevronLeft,
  ChevronRight,
  Database,
  Info,
  Palette,
  Pointer,
  User,
} from "@/components/icons";
import { Page } from "@/components/page";
import { AccountSection } from "@/components/settings-account";
import { AppearanceSection, BehaviorSection } from "@/components/settings-appearance";
import { CustomizeSection } from "@/components/settings-customize";
import { AboutSection, DataSection } from "@/components/settings-data";

const ORDER = ["account", "appearance", "behavior", "customize", "data", "about"] as const;

type Section = (typeof ORDER)[number];

const SECTIONS = {
  account: { name: "Account", group: "General", Icon: User, Body: AccountSection },
  appearance: { name: "Appearance", group: "General", Icon: Palette, Body: AppearanceSection },
  behavior: { name: "Behavior", group: "General", Icon: Pointer, Body: BehaviorSection },
  customize: { name: "Customize", group: "Sirathic", Icon: Adjustments, Body: CustomizeSection },
  data: { name: "Data controls", group: "Data and information", Icon: Database, Body: DataSection },
  about: { name: "About", group: "Data and information", Icon: Info, Body: AboutSection },
} satisfies Record<Section, { name: string; group: string; Icon: typeof User; Body: FC }>;

const GROUPS = [...new Set(Object.values(SECTIONS).map((section) => section.group))];

export default function SettingsScreen() {
  const [open, setOpen] = useState<Section>();

  useFocusEffect(
    useCallback(() => {
      if (!open) return;
      const back = BackHandler.addEventListener("hardwareBackPress", () => {
        setOpen(undefined);
        return true;
      });
      return () => back.remove();
    }, [open]),
  );

  useFocusEffect(useCallback(() => () => setOpen(undefined), []));

  if (open) {
    const { name, Body } = SECTIONS[open];
    return (
      <Page title={name}>
        <Pressable
          onPress={() => setOpen(undefined)}
          className="active:bg-muted -ms-2 mb-2 h-8 flex-row items-center gap-1 self-start rounded-md px-2"
        >
          <ChevronLeft size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
          <Text className="text-muted-foreground font-sans text-sm">Settings</Text>
        </Pressable>
        <Body />
      </Page>
    );
  }

  return (
    <Page title="Settings">
      {GROUPS.map((group) => (
        <View key={group} className="mb-5">
          <Text className="text-muted-foreground font-sans mb-1 text-xs">{group}</Text>
          {ORDER.filter((key) => SECTIONS[key].group === group).map((key) => {
            const { name, Icon } = SECTIONS[key];
            return (
              <Pressable
                key={key}
                onPress={() => setOpen(key)}
                className="active:bg-muted -mx-2 h-11 flex-row items-center gap-3 rounded-lg px-2"
              >
                <Icon size={22} strokeWidth={1.75} colorClassName="accent-foreground" />
                <Text className="text-foreground flex-1 font-sans text-sm">{name}</Text>
                <ChevronRight
                  size={20}
                  strokeWidth={1.75}
                  colorClassName="accent-muted-foreground"
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </Page>
  );
}
