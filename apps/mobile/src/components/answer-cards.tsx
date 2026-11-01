import { ANSWER_CARDS, shownPlaces, steps, translation } from "@sirathic/server/cards";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { type FC, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Brain, Check, Copy, Pin, Search } from "./icons";
import { IslamicDatesCard, PrayerTimesCard, SettingChanged } from "./day-cards";
import { ProductsCard } from "./products-card";
import { QuizCard } from "./quiz-card";
import { Swap } from "./motion";
import { TodoCard } from "./todo-card";

const NAMES = new Set<string>(ANSWER_CARDS);

const RIGHT_TO_LEFT =
  /^[^A-Za-z\u00C0-\u024F\u0590-\u07BF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]*[\u0590-\u07BF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;

export const isAnswerCard = (name: string) => NAMES.has(name);

const pill = "bg-foreground/8 active:bg-foreground/12 h-8 justify-center rounded-full px-3";

const StepNumber: FC<{ at: number }> = ({ at }) => (
  <View className="bg-foreground size-6 items-center justify-center rounded-full">
    <Text className="text-background font-sans text-xs font-medium">{at + 1}</Text>
  </View>
);

const Step: FC<{ at: number; title: string; description: string }> = ({
  at,
  title,
  description,
}) => (
  <View className="flex-row gap-3">
    <StepNumber at={at} />
    <View className="flex-1">
      <Text className="text-foreground font-sans text-base font-medium">{title}</Text>
      <Text className="text-muted-foreground font-sans mt-1 text-base leading-relaxed">
        {description}
      </Text>
    </View>
  </View>
);

const StepsCard: FC<{ input: unknown }> = ({ input }) => {
  const shown = steps.safeParse(input).data;
  const [at, setAt] = useState(0);
  const [all, setAll] = useState(shown?.view === "list");
  if (!shown) return null;
  const step = shown.steps[at];
  const count = shown.steps.length;
  return (
    <View className="bg-foreground/7 my-2 w-full rounded-3xl p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-muted-foreground font-sans text-sm">
          {all ? `${count} steps` : `Step ${at + 1} of ${count}`}
        </Text>
        <Pressable onPress={() => setAll(!all)}>
          <Text className="text-muted-foreground font-sans text-sm">
            {all ? "One at a time" : "Show all"}
          </Text>
        </Pressable>
      </View>
      {all ? (
        <View className="gap-4">
          {shown.steps.map((item, index) => (
            <Step key={item.title} at={index} {...item} />
          ))}
        </View>
      ) : (
        step && (
          <>
            <Step at={at} {...step} />
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable
                disabled={at === 0}
                onPress={() => setAt(at - 1)}
                className={`${pill} ${at === 0 ? "opacity-40" : ""}`}
              >
                <Text className="text-foreground font-sans text-sm font-medium">Back</Text>
              </Pressable>
              <Pressable
                onPress={() => (at < count - 1 ? setAt(at + 1) : setAll(true))}
                className={pill}
              >
                <Text className="text-foreground font-sans text-sm font-medium">
                  {at < count - 1 ? "Next" : "Show all"}
                </Text>
              </Pressable>
            </View>
          </>
        )
      )}
    </View>
  );
};

const TranslationCard: FC<{ input: unknown }> = ({ input }) => {
  const shown = translation.safeParse(input).data;
  const [copied, setCopied] = useState(false);
  if (!shown) return null;
  const copy = () =>
    void Clipboard.setStringAsync(shown.translation).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  return (
    <View className="bg-foreground/7 my-2 w-full gap-1 rounded-3xl p-1.5">
      <View className="px-3 pt-2 pb-3">
        <Text className="text-muted-foreground font-sans mb-1 text-sm">{shown.sourceLanguage}</Text>
        <Text className="text-foreground font-sans text-base leading-relaxed">{shown.text}</Text>
      </View>
      <View className="bg-background rounded-2xl px-3 pt-2 pb-3">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-muted-foreground font-sans text-sm">{shown.targetLanguage}</Text>
          <Pressable accessibilityLabel="Copy" onPress={copy} className="-me-1 p-1">
            <Swap
              swapped={copied}
              from={<Copy size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />}
              to={<Check size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />}
            />
          </Pressable>
        </View>
        <Text
          className={`text-foreground font-sans text-xl leading-loose ${RIGHT_TO_LEFT.test(shown.translation) ? "text-right" : ""}`}
        >
          {shown.translation}
        </Text>
        {shown.pronunciation !== undefined && (
          <Text className="text-muted-foreground font-sans mt-1 text-base leading-relaxed">
            {shown.pronunciation}
          </Text>
        )}
      </View>
    </View>
  );
};

const PlacesCard: FC<{ output: unknown }> = ({ output }) => {
  const shown = shownPlaces.safeParse(output).data;
  if (!shown) return null;
  return (
    <View className="bg-foreground/7 my-2 w-full rounded-3xl px-4">
      {shown.places.map((place, index) => (
        <View
          key={place.placeId}
          className={`flex-row gap-3 py-4 ${index > 0 ? "border-foreground/10 border-t" : ""}`}
        >
          {place.thumbnailUrl ? (
            <Image
              source={{ uri: place.thumbnailUrl }}
              className="bg-foreground/8 size-16 rounded-xl"
            />
          ) : (
            <View className="bg-foreground/8 size-16 items-center justify-center rounded-xl">
              <Pin size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
            </View>
          )}
          <View className="flex-1">
            <Pressable
              accessibilityRole="link"
              onPress={() => void WebBrowser.openBrowserAsync(place.placeUrl)}
            >
              <Text className="text-foreground font-sans text-base font-medium underline">
                {place.name}
              </Text>
            </Pressable>
            <Text className="text-muted-foreground font-sans text-sm">
              {[
                place.rating !== undefined &&
                  `★ ${place.rating}${place.reviews !== undefined ? ` (${place.reviews})` : ""}`,
                place.openStatus,
              ]
                .filter(Boolean)
                .join("  ")}
            </Text>
            {place.address !== undefined && (
              <Text className="text-muted-foreground font-sans text-sm">{place.address}</Text>
            )}
            {place.description !== undefined && (
              <Text className="text-foreground font-sans mt-1.5 text-base leading-relaxed">
                {place.description}
              </Text>
            )}
            {place.tips !== undefined && place.tips.length > 0 && (
              <View className="mt-2 flex-row flex-wrap gap-1.5">
                {place.tips.map((tip) => (
                  <Text
                    key={tip}
                    className="bg-foreground/8 text-foreground font-sans overflow-hidden rounded-full px-2.5 py-0.5 text-sm"
                  >
                    {tip}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>
      ))}
      <Text className="text-muted-foreground font-sans py-2 text-xs">Places from Google Maps</Text>
    </View>
  );
};

export const AnswerCard: FC<{ name: string; callId: string; input: unknown; output: unknown }> = ({
  name,
  callId,
  input,
  output,
}) => {
  switch (name) {
    case "show_steps":
      return <StepsCard input={input} />;
    case "show_quiz":
      return <QuizCard input={input} />;
    case "show_translation":
      return <TranslationCard input={input} />;
    case "show_places":
      return <PlacesCard output={output} />;
    case "show_products":
      return <ProductsCard output={output} />;
    case "prayer_times":
      return <PrayerTimesCard output={output} />;
    case "islamic_dates":
      return <IslamicDatesCard output={output} />;
    case "change_setting":
      return <SettingChanged output={output} />;
    case "todo_write":
      return <TodoCard callId={callId} output={output} />;
    default:
      return null;
  }
};

export const ResearchCard: FC<{ rationale: string; onResearch: () => void }> = ({
  rationale,
  onResearch,
}) => (
  <View className="border-foreground/10 my-2 gap-3 rounded-2xl border p-3">
    <Text className="text-muted-foreground font-sans text-sm">{rationale}</Text>
    <Pressable
      onPress={onResearch}
      className="bg-foreground h-8 flex-row items-center gap-1.5 self-start rounded-full px-3"
    >
      <Search size={16} strokeWidth={2} colorClassName="accent-background" />
      <Text className="text-background font-sans text-sm font-medium">Research this</Text>
    </Pressable>
  </View>
);

export const MemoryUsed: FC = () => (
  <Pressable
    accessibilityRole="link"
    onPress={() => router.navigate("/settings")}
    className="mt-3 flex-row items-center gap-1.5 self-start"
  >
    <Brain size={16} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
    <Text className="text-muted-foreground font-sans text-sm">Used your memory</Text>
  </Pressable>
);
