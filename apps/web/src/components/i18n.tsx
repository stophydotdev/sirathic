"use client";

import {
  hasLocale,
  isRtl,
  type Locale,
  type Messages,
  translate,
  type Values,
} from "@/components/locales";
import { usePreferences } from "@/components/preferences";
import type { MessageKey } from "@/messages/en";
import { Direction } from "radix-ui";
import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";

const I18nContext = createContext<{
  locale: Locale;
  messages: Messages | undefined;
}>({ locale: "en", messages: undefined });

export const I18nProvider: FC<{
  locale: Locale;
  messages: Messages | undefined;
  children: ReactNode;
}> = ({ locale, messages, children }) => {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);

  useEffect(() => {
    usePreferences.getState().load();
  }, []);

  return (
    <I18nContext value={value}>
      <Direction.Provider dir={isRtl(locale) ? "rtl" : "ltr"}>{children}</Direction.Provider>
    </I18nContext>
  );
};

export const useLocale = () => useContext(I18nContext).locale;

export function useT() {
  const { messages } = useContext(I18nContext);
  return useCallback(
    <Key extends MessageKey>(key: Key, ...values: Values<Key>) =>
      translate(messages, key, ...values),
    [messages],
  );
}

export type Translate = ReturnType<typeof useT>;

export function useLocalePath() {
  const locale = useLocale();
  return useCallback((path: string) => `/${locale}${path === "/" ? "" : path}`, [locale]);
}

export const browserLocale = (): Locale =>
  (globalThis.navigator?.languages ?? []).map((tag) => tag.split("-")[0] ?? "").find(hasLocale) ??
  "en";
