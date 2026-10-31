import { islamicDays, PRAYERS, prayerTimetable, settingChange } from "@sirathic/server/cards";
import { router } from "expo-router";
import { type FC, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { z } from "zod";
import { UserEdit } from "./icons";
import { MADHAB_NAMES } from "./settings-customize";

const PRAYER_NAMES = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
} as const;

const DAY_MS = 86_400_000;

const atNoon = (date: string) => new Date(`${date}T12:00:00Z`);

const shortDate = (date: string) =>
  atNoon(date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

const nextPrayer = ({ days, timezone }: z.infer<typeof prayerTimetable>) => {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const time = now.toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const first = days[0];
  if (first?.date !== today) return undefined;
  return PRAYERS.find((prayer) => prayer !== "sunrise" && first[prayer] > time);
};

export const PrayerTimesCard: FC<{ output: unknown }> = ({ output }) => {
  const shown = prayerTimetable.safeParse(output).data;
  const [all, setAll] = useState(false);
  const first = shown?.days[0];
  if (!shown || !first) return null;
  const next = nextPrayer(shown);
  return (
    <View className="bg-foreground/7 my-2 w-full rounded-3xl p-4">
      <View className="mb-3 flex-row items-baseline justify-between gap-3">
        <Text className="text-foreground font-sans flex-1 text-base font-medium">
          {shown.place ?? "Prayer times"}
        </Text>
        <Text className="text-muted-foreground font-sans text-sm">{shortDate(first.date)}</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {PRAYERS.map((prayer) => (
          <View
            key={prayer}
            className={`${prayer === next ? "bg-foreground" : "bg-background"} grow basis-1/4 rounded-2xl px-3 py-2`}
          >
            <Text
              className={`${prayer === next ? "text-background" : "text-muted-foreground"} font-sans text-xs`}
            >
              {prayer === next ? `Next · ${PRAYER_NAMES[prayer]}` : PRAYER_NAMES[prayer]}
            </Text>
            <Text
              className={`${prayer === next ? "text-background" : "text-foreground"} font-sans text-lg font-medium`}
            >
              {first[prayer]}
            </Text>
          </View>
        ))}
      </View>
      {all &&
        shown.days.slice(1).map((day) => (
          <Text key={day.date} className="text-muted-foreground font-sans mt-2 text-xs">
            {`${shortDate(day.date)}  ${PRAYERS.map((prayer) => day[prayer]).join("  ")}`}
          </Text>
        ))}
      {shown.days.length > 1 && (
        <Pressable onPress={() => setAll(!all)} className="mt-3 self-start">
          <Text className="text-muted-foreground font-sans text-sm">
            {all ? "Hide" : `All ${shown.days.length} days`}
          </Text>
        </Pressable>
      )}
      <Text className="text-muted-foreground font-sans mt-3 text-xs">
        Calculated times. Your masjid's times can differ.
      </Text>
    </View>
  );
};

export const IslamicDatesCard: FC<{ output: unknown }> = ({ output }) => {
  const shown = islamicDays.safeParse(output).data;
  if (!shown) return null;
  const today = atNoon(new Date().toLocaleDateString("en-CA")).getTime();
  const inDays = (date: string) => {
    const days = Math.round((atNoon(date).getTime() - today) / DAY_MS);
    return days === 0 ? "today" : days === 1 ? "tomorrow" : days > 0 ? `in ${days} days` : "";
  };
  return (
    <View className="bg-foreground/7 my-2 w-full rounded-3xl p-4">
      <Text className="text-foreground font-sans text-lg font-medium">{shown.hijri}</Text>
      <Text className="text-muted-foreground font-sans text-sm">{shortDate(shown.gregorian)}</Text>
      {shown.upcoming.length > 0 && (
        <View className="bg-background mt-3 rounded-2xl px-3">
          {shown.upcoming.map((event, index) => (
            <View
              key={event.name}
              className={`flex-row items-center justify-between gap-3 py-2.5 ${index > 0 ? "border-foreground/10 border-t" : ""}`}
            >
              <View className="flex-1">
                <Text className="text-foreground font-sans text-base font-medium">
                  {event.name}
                </Text>
                <Text className="text-muted-foreground font-sans text-sm">
                  {shortDate(event.gregorian)}
                </Text>
              </View>
              <Text className="text-muted-foreground font-sans text-sm">
                {inDays(event.gregorian)}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text className="text-muted-foreground font-sans mt-3 text-xs">
        Expected dates. A month can start a day earlier or later where the moon is sighted.
      </Text>
    </View>
  );
};

export const SettingChanged: FC<{ output: unknown }> = ({ output }) => {
  const change = settingChange.safeParse(output).data;
  if (!change) return null;
  const said = [
    change.madhab && `Madhab set to ${MADHAB_NAMES[change.madhab]}`,
    change.name !== undefined && `Name set to ${change.name}`,
    change.about !== undefined && "Updated what you told me about yourself",
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.navigate("/settings")}
      className="my-2 flex-row items-center gap-1.5 self-start"
    >
      <UserEdit size={16} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
      <Text className="text-muted-foreground font-sans text-sm">{said.join(" · ")}</Text>
    </Pressable>
  );
};
