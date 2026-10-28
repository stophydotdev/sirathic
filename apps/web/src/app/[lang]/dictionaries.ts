import {
  hasLocale,
  type Locale,
  type Messages,
  translate,
  type Values,
} from "@/components/locales";
import type { MessageKey } from "@/messages/en";
import { notFound } from "next/navigation";

const dictionaries = {
  ar: () => import("@/messages/ar").then((module) => module.default),
  fr: () => import("@/messages/fr").then((module) => module.default),
  es: () => import("@/messages/es").then((module) => module.default),
  it: () => import("@/messages/it").then((module) => module.default),
  ru: () => import("@/messages/ru").then((module) => module.default),
  tr: () => import("@/messages/tr").then((module) => module.default),
  az: () => import("@/messages/az").then((module) => module.default),
  bs: () => import("@/messages/bs").then((module) => module.default),
  sr: () => import("@/messages/sr").then((module) => module.default),
  sl: () => import("@/messages/sl").then((module) => module.default),
  uz: () => import("@/messages/uz").then((module) => module.default),
  ky: () => import("@/messages/ky").then((module) => module.default),
  id: () => import("@/messages/id").then((module) => module.default),
  tl: () => import("@/messages/tl").then((module) => module.default),
  zh: () => import("@/messages/zh").then((module) => module.default),
  ug: () => import("@/messages/ug").then((module) => module.default),
  ja: () => import("@/messages/ja").then((module) => module.default),
  vi: () => import("@/messages/vi").then((module) => module.default),
  th: () => import("@/messages/th").then((module) => module.default),
  km: () => import("@/messages/km").then((module) => module.default),
  fa: () => import("@/messages/fa").then((module) => module.default),
  ku: () => import("@/messages/ku").then((module) => module.default),
  ps: () => import("@/messages/ps").then((module) => module.default),
  hi: () => import("@/messages/hi").then((module) => module.default),
  bn: () => import("@/messages/bn").then((module) => module.default),
  te: () => import("@/messages/te").then((module) => module.default),
  ml: () => import("@/messages/ml").then((module) => module.default),
  as: () => import("@/messages/as").then((module) => module.default),
  ta: () => import("@/messages/ta").then((module) => module.default),
  si: () => import("@/messages/si").then((module) => module.default),
  ff: () => import("@/messages/ff").then((module) => module.default),
  sw: () => import("@/messages/sw").then((module) => module.default),
} satisfies Record<Exclude<Locale, "en">, () => Promise<Messages>>;

export const getDictionary = async (locale: Locale) =>
  locale === "en" ? undefined : dictionaries[locale]();

export const translator = async (lang: string) => {
  if (!hasLocale(lang)) notFound();
  const messages = await getDictionary(lang);
  return {
    locale: lang,
    t: <Key extends MessageKey>(key: Key, ...values: Values<Key>) =>
      translate(messages, key, ...values),
  };
};
