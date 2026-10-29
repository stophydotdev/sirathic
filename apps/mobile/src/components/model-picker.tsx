import { type ComponentRef, type FC, type RefObject, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useChatState } from "@/lib/chat-state";
import { EFFORT_NAMES, EffortSlider, SLIDER_HEIGHT, useEffort } from "./effort-slider";
import { GLASS, GlassFill } from "./glass";
import { Check, ChevronRight } from "./icons";
import { MenuHeading } from "./menu";
import { Pop } from "./motion";
import { Overlay } from "./overlay";

const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1);

const bigRow = "min-h-12 flex-row items-center gap-3 rounded-xl px-2 active:bg-foreground/8";
const bigText = "text-foreground font-sans text-base";

const ModelList: FC<{ onChosen: () => void }> = ({ onChosen }) => {
  const models = useChatState((s) => s.models);
  const chosen = useChatState((s) => s.model);
  const choose = useChatState((s) => s.choose);
  const current = models.find((model) => model.slug === chosen) ?? models[0];
  const groups = [
    { label: "Sirathic", models: models.filter((model) => model.maker === "sirathic") },
    {
      label: "From your ChatGPT account",
      models: models.filter((model) => model.maker !== "sirathic"),
    },
  ].filter((group) => group.models.length > 0);

  return (
    <Pop
      from="bottom"
      duration={150}
      fade={!GLASS}
      className={`border-foreground/10 w-72 rounded-2xl border p-1.5 shadow-lg ${GLASS ? "" : "bg-card"}`}
    >
      <GlassFill radius={16} />
      <ScrollView className="max-h-80">
        {models.length === 0 && (
          <Text className="text-muted-foreground font-sans p-2 text-sm">
            No chat models available
          </Text>
        )}
        {groups.map((group) => (
          <View key={group.label}>
            {groups.length > 1 && <MenuHeading>{group.label}</MenuHeading>}
            {group.models.map((model) => (
              <Pressable
                key={model.slug}
                accessibilityRole="menuitem"
                onPress={() => {
                  choose(model.slug);
                  onChosen();
                }}
                className={bigRow}
              >
                <Text numberOfLines={1} className={`${bigText} flex-1`}>
                  {model.name}
                </Text>
                {model.slug === current?.slug && (
                  <Check size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </Pop>
  );
};

export const ModelPicker: FC<{
  box: RefObject<ComponentRef<typeof View> | null>;
  hidden: Animated.Value;
}> = ({ box, hidden }) => {
  const models = useChatState((s) => s.models);
  const chosen = useChatState((s) => s.model);
  const current = models.find((model) => model.slug === chosen) ?? models[0];
  const effort = EFFORT_NAMES[useEffort()];
  const reduced = useReducedMotion();
  const screen = useWindowDimensions();
  const chip = useRef<ComponentRef<typeof Pressable>>(null);
  const backdrop = useRef<ComponentRef<typeof Pressable>>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [listing, setListing] = useState(false);
  const [frame, setFrame] = useState({ y: 0, height: 0 });
  const [from, setFrom] = useState({ x: 0, y: 0, boxY: 0, boxHeight: 0 });
  const [panelHeight, setPanelHeight] = useState(0);
  const placed = frame.height > 0 && panelHeight > 0;

  const close = () => {
    setListing(false);
    setOpen(false);
  };

  const start = () =>
    chip.current?.measureInWindow((x, y, width, height) =>
      box.current?.measureInWindow((_x, boxY, _width, boxHeight) => {
        setFrom({ x: x + width / 2, y: y + height / 2, boxY, boxHeight });
        setShown(true);
        setOpen(true);
      }),
    );

  useEffect(() => () => hidden.setValue(0), [hidden]);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => {
      setListing(false);
      setOpen(false);
    };
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    const hiddenKeyboard = Keyboard.addListener("keyboardDidHide", dismiss);
    const shownKeyboard = Keyboard.addListener("keyboardDidShow", dismiss);
    return () => {
      back.remove();
      hiddenKeyboard.remove();
      shownKeyboard.remove();
    };
  }, [open]);

  useEffect(() => {
    if (!shown || (open && !placed)) return;
    const run = Animated.timing(hidden, {
      toValue: open ? 1 : 0,
      duration: reduced ? 0 : open ? 150 : 130,
      easing: EASE_OUT_QUINT,
      useNativeDriver: true,
    });
    run.start(({ finished }) => {
      if (finished && !open) setShown(false);
    });
    return () => run.stop();
  }, [open, shown, placed, reduced, hidden]);

  const bottom = frame.y + frame.height - from.boxY - (from.boxHeight + SLIDER_HEIGHT) / 2;
  const middle = frame.y + frame.height - bottom - panelHeight / 2;
  const grow = (offset: number) =>
    hidden.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });

  return (
    <>
      <Pressable
        ref={chip}
        accessibilityRole="button"
        accessibilityLabel={`Model ${current?.name ?? ""}, effort ${effort}`}
        onPress={start}
        className="active:bg-muted h-10 max-w-48 justify-center rounded-full px-2.5"
      >
        <Text numberOfLines={1} className="text-foreground font-semibold text-sm">
          {current?.name ?? "Model"}{" "}
          <Text className="text-muted-foreground font-sans">{effort}</Text>
        </Text>
      </Pressable>
      {shown && (
        <Overlay>
          <Pressable
            accessibilityLabel="Close"
            onPress={close}
            ref={backdrop}
            onLayout={() =>
              backdrop.current?.measureInWindow((_x, y, _width, height) => setFrame({ y, height }))
            }
            className="absolute inset-0"
          >
            <Animated.View style={{ opacity: hidden }} className="absolute inset-0 bg-black/60" />
          </Pressable>
          <Animated.View
            pointerEvents={open && placed ? "box-none" : "none"}
            onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
            style={{
              bottom,
              opacity: placed ? hidden : 0,
              transform: [
                { translateX: grow(from.x - screen.width / 2) },
                { translateY: grow(from.y - middle) },
                { scale: hidden.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
            }}
            className="absolute inset-x-7 items-center gap-3"
          >
            {listing && <ModelList onChosen={() => setListing(false)} />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose model"
              accessibilityState={{ expanded: listing }}
              onPress={() => setListing(!listing)}
              className="flex-row items-center gap-1"
            >
              <Text className="text-foreground font-semibold text-lg">
                {current?.name ?? "Model"}{" "}
                <Text className="text-muted-foreground font-sans">{effort}</Text>
              </Text>
              <ChevronRight size={18} strokeWidth={2} colorClassName="accent-muted-foreground" />
            </Pressable>
            <EffortSlider />
          </Animated.View>
        </Overlay>
      )}
    </>
  );
};
