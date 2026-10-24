import type { Mode } from "@sirathic/server/messages";
import type { api } from "@/lib/trpc";

const GA_ID = "";
export const CONSENT_KEY = "sirathicAnalytics";
const SITE_HOST = "sirathic.com";
const SIGNING_IN_KEY = "sirathicSigningIn";
const NEW_ACCOUNT_MS = 10 * 60_000;

export const analyticsScript =
  GA_ID &&
  `if(location.hostname==="${SITE_HOST}"){window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};var g="denied";try{if(localStorage.getItem("${CONSENT_KEY}")==="granted")g="granted"}catch(e){}gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:g});gtag("js",new Date());gtag("config","${GA_ID}");var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}";document.head.appendChild(s)}`;

type AnalyticsEvent =
  | { name: "ask_question"; params: { mode: Mode; model: string } }
  | { name: "login" | "sign_up"; params: { method: SignInMethod } }
  | { name: "answer_feedback"; params: { value: "up" | "down" | "none" } }
  | { name: "share"; params: { method: "link" | "markdown" | "pdf"; content_type: "chat" } };

type ConsentUpdate = { analytics_storage: "granted" | "denied" };

declare global {
  interface Window {
    gtag?: {
      (command: "event", name: AnalyticsEvent["name"], params: AnalyticsEvent["params"]): void;
      (command: "consent", name: "update", params: ConsentUpdate): void;
    };
  }
}

export const track = ({ name, params }: AnalyticsEvent) => window.gtag?.("event", name, params);

export const setAnalyticsConsent = (granted: boolean) =>
  window.gtag?.("consent", "update", { analytics_storage: granted ? "granted" : "denied" });

type SignInMethod = "google" | "chatgpt";

export const markSignInStarted = (method: SignInMethod) => {
  try {
    sessionStorage.setItem(SIGNING_IN_KEY, method);
  } catch {}
};

export const reportSignIn = (status: Awaited<ReturnType<typeof api.account.status.query>>) => {
  if (!status.signedIn) return;
  let method: string | null = null;
  try {
    method = sessionStorage.getItem(SIGNING_IN_KEY);
    sessionStorage.removeItem(SIGNING_IN_KEY);
  } catch {}
  if (method !== "google" && method !== "chatgpt") return;
  const isNew = Date.now() - Date.parse(status.joinedAt) < NEW_ACCOUNT_MS;
  track({ name: isNew ? "sign_up" : "login", params: { method } });
};
