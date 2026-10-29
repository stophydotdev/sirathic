import type { FC, ReactNode } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GLASS } from "./glass";

const ABOVE_BOTTOM = 12;
const ABOVE_KEYBOARD = 8;

export const ComposerDock: FC<{
  children: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}> = ({ children, onLayout }) => {
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const closed = insets.bottom + ABOVE_BOTTOM;
  const style = useAnimatedStyle(() => ({
    paddingBottom: interpolate(progress.value, [0, 1], [closed, ABOVE_KEYBOARD]),
  }));
  return (
    <View onLayout={onLayout} className={GLASS ? undefined : "bg-background"}>
      <Animated.View style={style}>
        <View className="px-3">{children}</View>
      </Animated.View>
    </View>
  );
};
