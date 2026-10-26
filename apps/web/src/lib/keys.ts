import { useSyncExternalStore } from "react";

const isMac = () => /Mac|iPhone|iPad/u.test(globalThis.navigator?.userAgent ?? "");

export const withMod = (event: KeyboardEvent) => (isMac() ? event.metaKey : event.ctrlKey);

const unchanging = () => () => undefined;

export const useKeyNames = () =>
  useSyncExternalStore(unchanging, isMac, () => false)
    ? { mod: "⌘", shift: "⇧" }
    : { mod: "Ctrl", shift: "Shift" };
