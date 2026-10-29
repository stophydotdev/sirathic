import { type FC, type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1);

const useProgress = (to: number, duration: number, from = to) => {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(from)).current;
  useEffect(() => {
    const run = Animated.timing(value, {
      toValue: to,
      duration: reduced ? 0 : duration,
      easing: EASE_OUT_QUINT,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [to, duration, reduced, value]);
  return value;
};

const POP_FROM = {
  center: { origin: "center", scale: 0.95, shift: 0 },
  top: { origin: "center", scale: 0.95, shift: -8 },
  bottom: { origin: "center", scale: 0.95, shift: 8 },
  start: { origin: "left center", scale: 0.8, shift: 0 },
  end: { origin: "right center", scale: 0.8, shift: 0 },
  "top-start": { origin: "left top", scale: 0.8, shift: 0 },
  "top-end": { origin: "right top", scale: 0.8, shift: 0 },
  "bottom-start": { origin: "left bottom", scale: 0.8, shift: 0 },
  "bottom-end": { origin: "right bottom", scale: 0.8, shift: 0 },
} as const;

export const Pop: FC<{
  children: ReactNode;
  className?: string;
  from?: keyof typeof POP_FROM;
  duration?: number;
  fade?: boolean;
}> = ({ children, className, from = "center", duration = 300, fade = true }) => {
  const shown = useProgress(1, duration, 0);
  const { origin, scale, shift } = POP_FROM[from];
  return (
    <Animated.View
      className={className}
      style={{
        opacity: fade ? shown : 1,
        transformOrigin: origin,
        transform: [
          { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
          { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [shift, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

export const Dim: FC<{ className?: string }> = ({ className }) => {
  const shown = useProgress(1, 300, 0);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ opacity: shown }}
      className={`absolute inset-0 bg-black/60 ${className ?? ""}`}
    />
  );
};

export const Swap: FC<{ swapped: boolean; from: ReactNode; to: ReactNode }> = ({
  swapped,
  from,
  to,
}) => {
  const value = useProgress(swapped ? 1 : 0, 250);
  const face = (shownAt: number) => ({
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1 - shownAt, shownAt] }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: shownAt ? [0.25, 1] : [1, 0.25],
        }),
      },
    ],
  });
  return (
    <View className="items-center justify-center">
      <Animated.View style={face(0)}>{from}</Animated.View>
      <Animated.View style={face(1)} className="absolute">
        {to}
      </Animated.View>
    </View>
  );
};

export const Turn: FC<{ turned: boolean; degrees?: number; children: ReactNode }> = ({
  turned,
  degrees = 90,
  children,
}) => {
  const value = useProgress(turned ? 1 : 0, 300);
  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: value.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", `${degrees}deg`],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

export const Fold: FC<{ open: boolean; children: ReactNode }> = ({ open, children }) => {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const value = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    const run = Animated.timing(value, {
      toValue: open ? 1 : 0,
      duration: reduced ? 0 : 300,
      easing: EASE_OUT_QUINT,
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [open, reduced, value]);
  return (
    <Animated.View
      pointerEvents={open ? "auto" : "none"}
      style={{ height: value.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }}
      className="overflow-hidden"
    >
      <View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        className="absolute inset-x-0 top-0"
      >
        {children}
      </View>
    </Animated.View>
  );
};

export const TabPill: FC<{ x: number; width: number }> = ({ x, width }) => {
  const reduced = useReducedMotion();
  const left = useRef(new Animated.Value(x)).current;
  const size = useRef(new Animated.Value(width)).current;
  useEffect(() => {
    const config = { duration: reduced ? 0 : 300, easing: EASE_OUT_QUINT, useNativeDriver: false };
    const run = Animated.parallel([
      Animated.timing(left, { ...config, toValue: x }),
      Animated.timing(size, { ...config, toValue: width }),
    ]);
    run.start();
    return () => run.stop();
  }, [x, width, reduced, left, size]);
  return (
    <Animated.View
      style={{ left, width: size }}
      className="bg-muted absolute inset-y-0 rounded-full"
    />
  );
};
