import { DEFAULT_EFFORT, type Effort, EFFORTS } from "@sirathic/server/messages";
import * as Haptics from "expo-haptics";
import { type ComponentRef, type FC, useEffect, useRef, useState } from "react";
import { Animated, Easing, PanResponder, View } from "react-native";
import { useChatState } from "@/lib/chat-state";
import { GLASS, GlassFill } from "./glass";

export const EFFORT_NAMES = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
} satisfies Record<Effort, string>;

const KNOB = 36;
export const SLIDER_HEIGHT = KNOB + 10;
const LAST = EFFORTS.length - 1;

export const useEffort = () => {
  const mode = useChatState((s) => s.mode);
  return useChatState((s) => s.effort) ?? DEFAULT_EFFORT[mode];
};

export const EffortSlider: FC = () => {
  const effort = useEffort();
  const setEffort = useChatState((s) => s.setEffort);
  const index = EFFORTS.indexOf(effort);
  const [width, setWidth] = useState(0);
  const left = useRef(0);
  const step = (width - KNOB) / LAST;
  const offset = useRef(new Animated.Value(0)).current;
  const trackRef = useRef<ComponentRef<typeof View>>(null);
  const placed = useRef(false);

  useEffect(() => {
    if (width === 0) return;
    if (!placed.current) {
      offset.setValue(index * step);
      placed.current = true;
      return;
    }
    Animated.timing(offset, {
      toValue: index * step,
      duration: 200,
      easing: Easing.out(Easing.poly(5)),
      useNativeDriver: false,
    }).start();
  }, [index, step, width, offset]);

  const pick = (pageX: number) => {
    const at = Math.round((pageX - left.current - KNOB / 2) / step);
    const level = EFFORTS[Math.max(0, Math.min(LAST, at))];
    if (level && level !== useChatState.getState().effort) {
      void Haptics.selectionAsync();
      setEffort(level);
    }
  };

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const { pageX } = event.nativeEvent;
      trackRef.current?.measureInWindow((x) => {
        left.current = x;
        pick(pageX);
      });
    },
    onPanResponderMove: (event) => pick(event.nativeEvent.pageX),
  });

  return (
    <View className={`border-border w-full rounded-full border p-1 ${GLASS ? "" : "bg-card"}`}>
      <GlassFill radius={23} />
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Effort"
        accessibilityValue={{ text: EFFORT_NAMES[effort] }}
        ref={trackRef}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        className="h-9 justify-center"
        {...responder.panHandlers}
      >
        <Animated.View
          style={{ width: Animated.add(offset, KNOB) }}
          className="bg-super absolute inset-y-0 start-0 rounded-full"
        />
        {EFFORTS.map((level, at) => (
          <View
            key={level}
            style={{ left: at * step + KNOB / 2 - 3 }}
            className={`absolute size-1.5 rounded-full ${at < index ? "bg-white/45" : "bg-foreground/30"}`}
          />
        ))}
        <Animated.View
          style={{ transform: [{ translateX: offset }] }}
          className="absolute start-0 size-9 rounded-full bg-white shadow-sm"
        />
      </View>
    </View>
  );
};
