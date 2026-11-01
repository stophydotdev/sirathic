import { faviconUrl } from "@/lib/sources";
import { shownProducts } from "@sirathic/server/cards";
import * as WebBrowser from "expo-web-browser";
import type { FC } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

export const ProductsCard: FC<{ output: unknown }> = ({ output }) => {
  const shown = shownProducts.safeParse(output).data;
  if (!shown) return null;
  const most =
    shown.products.length > 1
      ? shown.products.reduce<(typeof shown.products)[number] | undefined>(
          (best, item) => ((item.reviews ?? 0) > (best?.reviews ?? 0) ? item : best),
          undefined,
        )?.id
      : undefined;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="my-2 -mx-4"
      contentContainerClassName="gap-3 px-4"
    >
      {shown.products.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="link"
          onPress={() => void WebBrowser.openBrowserAsync(item.url)}
          className="border-foreground/10 bg-card w-52 overflow-hidden rounded-2xl border"
        >
          <View className="aspect-square bg-white">
            {item.imageUrl !== undefined && (
              <Image
                source={{ uri: item.imageUrl }}
                resizeMode="cover"
                className="absolute inset-0 size-full"
              />
            )}
            {item.id === most && (
              <Text className="font-sans absolute start-2 top-2 overflow-hidden rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                Most reviewed
              </Text>
            )}
          </View>
          <View className="flex-1 gap-1 p-3">
            <Text numberOfLines={1} className="text-foreground font-sans text-sm font-medium">
              {item.title}
            </Text>
            {item.rating !== undefined && (
              <Text className="text-muted-foreground font-sans text-xs">
                {`★ ${item.rating}${item.reviews === undefined ? "" : ` (${item.reviews.toLocaleString()})`}`}
              </Text>
            )}
            <Text numberOfLines={2} className="text-muted-foreground font-sans text-xs">
              <Text className="text-foreground">
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: item.currency,
                }).format(item.price)}
              </Text>
              {` · ${item.note}`}
            </Text>
            <View className="mt-auto flex-row items-center gap-1.5 pt-1">
              <Image
                source={{ uri: faviconUrl(item.storeUrl ?? item.url) }}
                className="size-4 rounded-sm"
              />
              <Text numberOfLines={1} className="text-muted-foreground font-sans flex-1 text-xs">
                {item.store}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
};
