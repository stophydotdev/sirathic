import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import type { FC } from "react";
import { Platform, StyleSheet } from "react-native";
import { useUniwind } from "uniwind";

export const GLASS = Platform.OS === "ios";

const LIQUID = GLASS && isGlassEffectAPIAvailable();

export const GlassFill: FC<{ radius: number }> = ({ radius }) => {
  const { theme } = useUniwind();
  if (!GLASS) return null;
  const scheme = theme === "light" ? "light" : "dark";
  const outline = [StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" as const }];
  return LIQUID ? (
    <GlassView pointerEvents="none" colorScheme={scheme} style={outline} />
  ) : (
    <BlurView pointerEvents="none" intensity={80} tint={scheme} style={outline} />
  );
};
