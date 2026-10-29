import {
  IconBook,
  IconBook2,
  IconBriefcase,
  IconBuildingMosque,
  IconBulb,
  IconCalendar,
  IconCode,
  IconCoin,
  IconCompass,
  IconFlame,
  IconFlask,
  IconHeart,
  IconHome,
  IconLanguage,
  IconLeaf,
  IconMap,
  IconMoon,
  IconPalette,
  IconPlane,
  IconPlant,
  IconPray,
  IconScale,
  IconSchool,
  IconSparkles,
  IconStar,
  IconSun,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react-native";
import { PROJECT_ICONS } from "@sirathic/server/projects";
import type { FC } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";
import { CalendarTime } from "./icons";

type Icon = (typeof PROJECT_ICONS)[number];

const ICONS = {
  book: withUniwind(IconBook),
  book2: withUniwind(IconBook2),
  mosque: withUniwind(IconBuildingMosque),
  pray: withUniwind(IconPray),
  moon: withUniwind(IconMoon),
  sun: withUniwind(IconSun),
  star: withUniwind(IconStar),
  heart: withUniwind(IconHeart),
  leaf: withUniwind(IconLeaf),
  plant: withUniwind(IconPlant),
  flame: withUniwind(IconFlame),
  bulb: withUniwind(IconBulb),
  school: withUniwind(IconSchool),
  language: withUniwind(IconLanguage),
  scale: withUniwind(IconScale),
  users: withUniwind(IconUsers),
  home: withUniwind(IconHome),
  briefcase: withUniwind(IconBriefcase),
  coin: withUniwind(IconCoin),
  calendar: withUniwind(IconCalendar),
  compass: withUniwind(IconCompass),
  map: withUniwind(IconMap),
  world: withUniwind(IconWorld),
  plane: withUniwind(IconPlane),
  code: withUniwind(IconCode),
  flask: withUniwind(IconFlask),
  palette: withUniwind(IconPalette),
  sparkles: withUniwind(IconSparkles),
} satisfies Record<Icon, typeof CalendarTime>;

export const ProjectIcon: FC<{ icon: Icon | null; size?: number }> = ({ icon, size = 18 }) => {
  const Shown = icon ? ICONS[icon] : CalendarTime;
  return <Shown size={size} strokeWidth={1.75} colorClassName="accent-foreground" />;
};

export const IconGrid: FC<{ icon: Icon | null; onPick: (icon: Icon | null) => void }> = ({
  icon,
  onPick,
}) => (
  <View className="flex-row flex-wrap gap-1.5">
    {[null, ...PROJECT_ICONS].map((option) => (
      <Pressable
        key={option ?? "default"}
        accessibilityRole="radio"
        accessibilityLabel={option ?? "Default"}
        accessibilityState={{ checked: option === icon }}
        onPress={() => onPick(option)}
        className={`size-10 items-center justify-center rounded-[10px] ${option === icon ? "bg-foreground/15" : "active:bg-muted"}`}
      >
        <ProjectIcon icon={option} />
      </Pressable>
    ))}
  </View>
);
