import type { Device } from "@sirathic/server/messages";

const LANDING = "sirathic.landing";

const siteOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "") ?? "";

export const deviceOf = (): Device => {
  if (!matchMedia("(pointer: coarse)").matches) return "desktop";
  return Math.min(screen.width, screen.height) < 600 ? "phone" : "tablet";
};

export const rememberLanding = () => {
  try {
    if (sessionStorage.getItem(LANDING) !== null) return;
    const from = siteOf(document.referrer);
    const tag = new URLSearchParams(location.search).get("ref");
    sessionStorage.setItem(LANDING, tag ?? (from === siteOf(location.href) ? "" : from));
  } catch {
    return;
  }
};

export const landingHeaders = (): Record<string, string> => {
  try {
    const ref = sessionStorage.getItem(LANDING);
    return ref ? { "x-sirathic-ref": ref } : {};
  } catch {
    return {};
  }
};
