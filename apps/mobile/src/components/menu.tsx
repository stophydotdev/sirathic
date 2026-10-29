import { type ComponentRef, type FC, type ReactNode, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GLASS, GlassFill } from "./glass";
import { Pop } from "./motion";
import { Overlay } from "./overlay";

type Anchor = { x: number; y: number; width: number; height: number };

const GAP = 8;
const OVERHANG = 6;

export const menuRow =
  "min-h-10 flex-row items-center gap-2 rounded-lg px-2 active:bg-foreground/8";
export const menuText = "text-foreground font-sans text-sm";

export const MenuHeading: FC<{ children: string }> = ({ children }) => (
  <Text className="text-muted-foreground font-sans h-6 px-2 text-xs leading-6">{children}</Text>
);

export const Menu: FC<{
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  contentClassName: string;
  align?: "start" | "end";
  overKeyboard?: boolean;
  children: (close: () => void) => ReactNode;
}> = ({
  label,
  trigger,
  triggerClassName,
  contentClassName,
  align = "start",
  overKeyboard = false,
  children,
}) => {
  const button = useRef<ComponentRef<typeof Pressable>>(null);
  const [anchor, setAnchor] = useState<Anchor>();
  const backdrop = useRef<ComponentRef<typeof Pressable>>(null);
  const [frame, setFrame] = useState({ y: 0, height: 0 });
  const [panelHeight, setPanelHeight] = useState(0);
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const close = () => {
    setAnchor(undefined);
    setPanelHeight(0);
  };
  const open = () =>
    button.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));

  useEffect(() => {
    if (!anchor || !overKeyboard) return;
    const dismiss = () => {
      setAnchor(undefined);
      setPanelHeight(0);
    };
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    const hidden = Keyboard.addListener("keyboardDidHide", dismiss);
    return () => {
      back.remove();
      hidden.remove();
    };
  }, [anchor, overKeyboard]);

  const above = anchor !== undefined && anchor.y > screen.height / 2;
  const side = overKeyboard ? OVERHANG : 0;
  const centered = (at: Anchor) =>
    Math.min(
      Math.max(at.y - frame.y + at.height / 2 - panelHeight / 2, insets.top + GAP),
      Math.min(
        frame.height - insets.bottom,
        (Keyboard.metrics()?.screenY ?? Number.POSITIVE_INFINITY) - frame.y,
      ) -
        panelHeight -
        GAP,
    );
  const vertical = (at: Anchor) =>
    overKeyboard
      ? { top: centered(at), opacity: panelHeight > 0 && frame.height > 0 ? 1 : 0 }
      : above
        ? { height: at.y - GAP }
        : { top: at.y + at.height + GAP };
  const panel = anchor && (
    <>
      <Pressable
        accessibilityLabel={label}
        onPress={close}
        ref={backdrop}
        onLayout={() =>
          backdrop.current?.measureInWindow((_x, y, _width, height) => setFrame({ y, height }))
        }
        className="absolute inset-0"
      />
      <View
        pointerEvents={overKeyboard && panelHeight === 0 ? "none" : "box-none"}
        onLayout={
          overKeyboard ? (event) => setPanelHeight(event.nativeEvent.layout.height) : undefined
        }
        style={{
          ...vertical(anchor),
          ...(align === "start"
            ? { left: anchor.x - side }
            : { width: anchor.x + anchor.width + side }),
        }}
        className={`absolute ${!overKeyboard && above ? "top-0 justify-end" : ""} ${align === "start" ? "" : "left-0 items-end"}`}
      >
        <Pop
          from={overKeyboard ? align : `${above ? "bottom" : "top"}-${align}`}
          duration={150}
          fade={!GLASS}
          className={`border-foreground/10 rounded-2xl border p-1.5 shadow-lg ${GLASS ? "" : "bg-card"} ${contentClassName}`}
        >
          <GlassFill radius={16} />
          {children(close)}
        </Pop>
      </View>
    </>
  );

  return (
    <>
      <Pressable
        ref={button}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={open}
        className={triggerClassName}
      >
        {trigger}
      </Pressable>
      {overKeyboard ? (
        panel && <Overlay>{panel}</Overlay>
      ) : (
        <Modal
          visible={anchor !== undefined}
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          animationType="none"
          onRequestClose={close}
        >
          {panel}
        </Modal>
      )}
    </>
  );
};
