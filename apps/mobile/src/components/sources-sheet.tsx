import type { Source } from "@sirathic/server/sources";
import * as WebBrowser from "expo-web-browser";
import { type FC, useState } from "react";
import { FlatList, Image, Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { faviconUrl, siteName } from "@/lib/sources";
import { X } from "./icons";
import { Pop } from "./motion";

const PAGE = 20;

export const SourcesSheet: FC<{
  sources: Source[];
  open: boolean;
  onClose: () => void;
}> = ({ sources, open, onClose }) => {
  const [shown, setShown] = useState(PAGE);
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={open}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable accessibilityLabel="Close" onPress={onClose} className="flex-1" />
      <View style={{ maxHeight: height * 0.75 }} className="top-safe-offset-16 absolute end-2 w-80">
        <Pop
          from="top"
          className="bg-card border-foreground/10 max-h-full rounded-2xl border shadow-lg"
        >
          <View className="h-12 flex-row items-center justify-between ps-4 pe-2">
            <Text className="text-foreground font-medium text-sm">
              Sources <Text className="text-muted-foreground">{sources.length}</Text>
            </Text>
            <Pressable
              accessibilityLabel="Close"
              onPress={onClose}
              className="active:bg-muted size-8 items-center justify-center rounded-full"
            >
              <X size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
            </Pressable>
          </View>
          <FlatList
            data={sources.slice(0, shown)}
            keyExtractor={(item) => item.url}
            contentContainerClassName="px-2 pb-2"
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(item.url)}
                className="active:bg-muted gap-0.5 rounded-lg px-2 py-2"
              >
                <View className="flex-row items-center gap-1.5">
                  <Image source={{ uri: faviconUrl(item.url) }} className="size-4 rounded-full" />
                  <Text
                    numberOfLines={1}
                    className="text-muted-foreground font-sans flex-1 text-xs"
                  >
                    {siteName(item.url)}
                  </Text>
                  <View className="bg-foreground/5 size-5 items-center justify-center rounded-md">
                    <Text className="text-muted-foreground font-semibold text-[10px]">
                      {index + 1}
                    </Text>
                  </View>
                </View>
                <Text numberOfLines={2} className="text-foreground/85 font-sans text-sm">
                  {item.title}
                </Text>
                {item.snippet !== "" && (
                  <Text
                    numberOfLines={2}
                    className="text-muted-foreground font-sans text-xs leading-5"
                  >
                    {item.snippet}
                  </Text>
                )}
              </Pressable>
            )}
            ListFooterComponent={
              shown < sources.length ? (
                <Pressable
                  onPress={() => setShown(shown + PAGE)}
                  className="bg-muted active:bg-foreground/10 mx-2 mt-1 h-8 items-center justify-center rounded-lg"
                >
                  <Text className="text-foreground font-sans text-sm">Show more</Text>
                </Pressable>
              ) : undefined
            }
          />
        </Pop>
      </View>
    </Modal>
  );
};
