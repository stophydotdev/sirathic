import type { Source } from "@sirathic/server/sources";
import * as WebBrowser from "expo-web-browser";
import { createContext, type FC, useContext, useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { faviconUrl, siteName } from "@/lib/sources";
import { ChevronLeft, ChevronRight } from "./icons";
import { Pop } from "./motion";

export const Cited = createContext<{
  runs: string[][];
  show: (urls: string[]) => void;
}>({ runs: [], show: () => undefined });

const hostOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "") ?? url;

export const CitationPill: FC<{ href: string; run: number }> = ({ href, run }) => {
  const { runs, show } = useContext(Cited);
  const urls = runs[run] ?? [href];
  const more = urls.length - 1;
  const name = siteName(href);
  const label = `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={more > 0 ? `${label} and ${more} more` : label}
      onPress={() => show(urls)}
      className="bg-muted active:bg-foreground/10 translate-y-1 flex-row items-center gap-1 rounded-full py-0.5 ps-0.5 pe-2"
    >
      <Image source={{ uri: faviconUrl(href) }} className="size-3.5 rounded-full" />
      <Text className="text-muted-foreground font-medium text-xs">{label}</Text>
      {more > 0 && <Text className="text-muted-foreground/70 font-medium text-xs">+{more}</Text>}
    </Pressable>
  );
};

const arrow = "bg-muted active:bg-foreground/10 size-11 items-center justify-center rounded-full";

export const CitationSheet: FC<{ urls: string[]; sources: Source[]; onClose: () => void }> = ({
  urls,
  sources,
  onClose,
}) => {
  const [at, setAt] = useState(0);
  const url = urls[at] ?? "";
  const found = sources.find((entry) => entry.url === url);

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable accessibilityLabel="Close" onPress={onClose} className="flex-1" />
      <Pop from="bottom" className="bg-card border-foreground/10 rounded-t-3xl border-t">
        <SafeAreaView edges={["bottom"]}>
          <View className="gap-3 px-4 pt-2.5 pb-3">
            <View className="bg-foreground/15 h-1 w-9 self-center rounded-full" />
            <View className="flex-row items-center gap-2">
              <Image source={{ uri: faviconUrl(url) }} className="size-4 rounded-full" />
              <Text numberOfLines={1} className="text-muted-foreground font-sans flex-1 text-sm">
                {hostOf(url)}
              </Text>
            </View>
            <Text numberOfLines={2} className="text-foreground font-semibold text-base">
              {found?.title || hostOf(url)}
            </Text>
            {found?.snippet ? (
              <Text numberOfLines={3} className="text-muted-foreground font-sans text-sm leading-5">
                {found.snippet}
              </Text>
            ) : null}
            <View className="flex-row items-center justify-between pt-1">
              {urls.length > 1 ? (
                <View className="flex-row items-center gap-1">
                  <Pressable
                    accessibilityLabel="Previous source"
                    disabled={at === 0}
                    onPress={() => setAt(at - 1)}
                    className={arrow}
                  >
                    <ChevronLeft
                      size={20}
                      strokeWidth={1.75}
                      colorClassName={at === 0 ? "accent-muted-foreground/40" : "accent-foreground"}
                    />
                  </Pressable>
                  <Text className="text-muted-foreground font-sans px-1.5 text-sm">
                    {at + 1} of {urls.length}
                  </Text>
                  <Pressable
                    accessibilityLabel="Next source"
                    disabled={at === urls.length - 1}
                    onPress={() => setAt(at + 1)}
                    className={arrow}
                  >
                    <ChevronRight
                      size={20}
                      strokeWidth={1.75}
                      colorClassName={
                        at === urls.length - 1 ? "accent-muted-foreground/40" : "accent-foreground"
                      }
                    />
                  </Pressable>
                </View>
              ) : (
                <View />
              )}
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(url)}
                className="bg-foreground active:bg-foreground/80 h-11 justify-center rounded-full px-5"
              >
                <Text className="text-background font-medium text-sm">Open</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Pop>
    </Modal>
  );
};
