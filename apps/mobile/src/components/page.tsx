import { useNavigation } from "expo-router";
import type { DrawerNavigationProp } from "expo-router/drawer";
import { type FC, type ReactNode, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Menu } from "./icons";
import { TabPill } from "./motion";
import { useSignIn } from "./sign-in";

export const MenuButton: FC = () => {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  return (
    <Pressable
      accessibilityLabel="Open menu"
      onPress={() => navigation.openDrawer()}
      className="bg-background/70 active:bg-muted size-11 items-center justify-center rounded-full"
    >
      <Menu size={24} strokeWidth={1.75} colorClassName="accent-foreground" />
    </Pressable>
  );
};

export const Page: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <View className="bg-background pt-safe flex-1">
    <View className="h-14 flex-row items-center px-2">
      <MenuButton />
    </View>
    <ScrollView contentContainerClassName="px-4 pt-2 pb-16">
      <Text className="text-foreground font-semibold mb-4 text-2xl">{title}</Text>
      {children}
    </ScrollView>
  </View>
);

export function Tabs<Tab extends string>({
  tabs,
  tab,
  onChange,
}: {
  tabs: readonly (readonly [Tab, string])[];
  tab: Tab;
  onChange: (tab: Tab) => void;
}) {
  const [spots, setSpots] = useState<Partial<Record<Tab, { x: number; width: number }>>>({});
  const spot = spots[tab];
  return (
    <View className="mb-4 flex-row gap-1">
      {spot && <TabPill x={spot.x} width={spot.width} />}
      {tabs.map(([value, label]) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab }}
          onPress={() => onChange(value)}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout;
            setSpots((all) => ({ ...all, [value]: { x, width } }));
          }}
          className="h-9 items-center justify-center rounded-full px-4"
        >
          <Text
            className={`font-medium text-sm ${value === tab ? "text-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export const EmptyBox: FC<{ title: string; hint?: string; signIn?: boolean }> = ({
  title,
  hint,
  signIn = false,
}) => {
  const ask = useSignIn((s) => s.ask);
  return (
    <View className="border-border items-center gap-2 rounded-2xl border border-dashed px-6 py-10">
      <Text className="text-foreground font-medium text-base">{title}</Text>
      {hint && <Text className="text-muted-foreground font-sans text-center text-sm">{hint}</Text>}
      {signIn && (
        <Pressable
          onPress={() => ask()}
          className="bg-foreground active:opacity-85 mt-2 h-9 items-center justify-center rounded-full px-4"
        >
          <Text className="text-background font-medium text-sm">Sign in</Text>
        </Pressable>
      )}
    </View>
  );
};

export const Row: FC<{ children: ReactNode; onPress?: () => void }> = ({ children, onPress }) => (
  <Pressable
    disabled={!onPress}
    onPress={onPress}
    className="border-border/60 active:bg-muted flex-row items-center gap-3 border-b py-3"
  >
    {children}
  </Pressable>
);
