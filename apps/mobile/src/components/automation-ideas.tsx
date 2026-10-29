import { blankDraft, type Draft } from "@sirathic/app/automationDraft";
import {
  IconBabyCarriage,
  IconBook,
  IconBookmark,
  IconBooks,
  IconBuildingMosque,
  IconCampfire,
  IconLanguage,
  IconMoon,
  IconPray,
  IconScale,
  IconSunrise,
  IconSunset,
  IconUsersGroup,
} from "@tabler/icons-react-native";
import type { FC } from "react";
import { Pressable, Text, View } from "react-native";
import { withUniwind } from "uniwind";

const Book = withUniwind(IconBook);
const Sunrise = withUniwind(IconSunrise);
const Sunset = withUniwind(IconSunset);
const Bookmark = withUniwind(IconBookmark);
const Books = withUniwind(IconBooks);
const Language = withUniwind(IconLanguage);
const Campfire = withUniwind(IconCampfire);
const Scale = withUniwind(IconScale);
const Mosque = withUniwind(IconBuildingMosque);
const Moon = withUniwind(IconMoon);
const Pray = withUniwind(IconPray);
const Baby = withUniwind(IconBabyCarriage);
const Family = withUniwind(IconUsersGroup);

const GROUPS = [
  {
    title: "Daily",
    tile: "bg-sky-500",
    templates: [
      {
        Icon: Book,
        name: "Daily hadith",
        prompt: "Share one authentic hadith with its grading and a short explanation.",
        schedule: { kind: "daily", time: "06:00" },
      },
      {
        Icon: Sunrise,
        name: "Morning adhkar",
        prompt: "Give me the morning adhkar with their sources and when to say them.",
        schedule: { kind: "daily", time: "05:30" },
      },
      {
        Icon: Sunset,
        name: "Evening adhkar",
        prompt: "Give me the evening adhkar with their sources and when to say them.",
        schedule: { kind: "daily", time: "17:30" },
      },
      {
        Icon: Bookmark,
        name: "Verse of the day",
        prompt: "Share one verse of the Quran with its translation and a short tafsir.",
        schedule: { kind: "daily", time: "07:00" },
      },
    ],
  },
  {
    title: "Learning",
    tile: "bg-violet-500",
    templates: [
      {
        Icon: Books,
        name: "Weekly tafsir",
        prompt: "Explain a few verses of a short surah from the classical tafsir books.",
        schedule: { kind: "weekly", days: [0], time: "09:00" },
      },
      {
        Icon: Language,
        name: "Quran word of the day",
        prompt: "Teach me one Arabic word from the Quran with its root and a verse using it.",
        schedule: { kind: "daily", time: "08:00" },
      },
      {
        Icon: Campfire,
        name: "Seerah story",
        prompt: "Tell me one story from the seerah of the Prophet ﷺ, with a lesson to take.",
        schedule: { kind: "weekly", days: [6], time: "10:00" },
      },
      {
        Icon: Scale,
        name: "Fiqh question explained",
        prompt: "Explain one everyday fiqh question with the view of each madhhab.",
        schedule: { kind: "weekly", days: [3], time: "20:00" },
      },
    ],
  },
  {
    title: "Worship",
    tile: "bg-emerald-600",
    templates: [
      {
        Icon: Mosque,
        name: "Friday reminder",
        prompt: "Remind me of the sunnah of Friday with one relevant hadith.",
        schedule: { kind: "weekly", days: [5], time: "11:00" },
      },
      {
        Icon: Moon,
        name: "Monday and Thursday fast",
        prompt: "Remind me that tomorrow is a sunnah fast day, with a hadith on its reward.",
        schedule: { kind: "weekly", days: [0, 3], time: "20:00" },
      },
      {
        Icon: Pray,
        name: "Nightly dua",
        prompt: "Give me one authentic dua for the night with its meaning and source.",
        schedule: { kind: "daily", time: "21:30" },
      },
    ],
  },
  {
    title: "Family",
    tile: "bg-amber-500",
    templates: [
      {
        Icon: Baby,
        name: "Prophet story for kids",
        prompt: "Tell a short story of a prophet for children, in simple words.",
        schedule: { kind: "daily", time: "19:30" },
      },
      {
        Icon: Family,
        name: "Family halaqa",
        prompt: "Suggest a topic for our family halaqa, with a verse, a hadith and questions.",
        schedule: { kind: "weekly", days: [5], time: "18:00" },
      },
    ],
  },
] as const;

export const AutomationIdeas: FC<{ onAdd: (draft: Draft) => void }> = ({ onAdd }) => (
  <View className="gap-8">
    {GROUPS.map(({ title, tile, templates }) => (
      <View key={title}>
        <Text className="text-foreground font-medium mb-2 text-base">{title}</Text>
        {templates.map(({ Icon, name, prompt, schedule }) => (
          <View key={name} className="min-h-16 flex-row items-center gap-3 py-2">
            <View className={`size-10 items-center justify-center rounded-xl ${tile}`}>
              <Icon size={20} strokeWidth={1.75} colorClassName="accent-white" />
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="text-foreground font-medium text-sm">
                {name}
              </Text>
              <Text numberOfLines={2} className="text-muted-foreground font-sans text-sm">
                {prompt}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                onAdd({
                  ...blankDraft(),
                  name,
                  prompt,
                  kind: schedule.kind,
                  time: schedule.time,
                  days: schedule.kind === "weekly" ? [...schedule.days] : [1],
                })
              }
              className="bg-muted active:bg-foreground/10 h-8 items-center justify-center rounded-full px-4"
            >
              <Text className="text-foreground font-medium text-sm">Add</Text>
            </Pressable>
          </View>
        ))}
      </View>
    ))}
  </View>
);
