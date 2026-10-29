import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "patchright";
import { z } from "zod";
import { masked } from "./mask";
import { type TaughtStep, taughtStep } from "./protocol";
import type { Session } from "./sessions";

const MAX_STEPS = 200;

const recorder = (binding: string) => `(() => {
  if (window[${JSON.stringify(`${binding}On`)}]) return;
  window[${JSON.stringify(`${binding}On`)}] = true;
  const send = (step) => window[${JSON.stringify(binding)}](step);
  const words = (text) => String(text || "").trim().replace(/\\s+/g, " ").slice(0, 80);
  const nameOf = (el) =>
    words(el.getAttribute("aria-label")) ||
    words(el.labels && el.labels[0] && el.labels[0].innerText) ||
    words(el.getAttribute("placeholder")) ||
    words(el.getAttribute("title")) ||
    words(el.innerText) ||
    words(el.getAttribute("value")) ||
    words(el.getAttribute("name"));
  const kindOf = (el) =>
    el.getAttribute("role") ||
    ({ A: "link", BUTTON: "button", SELECT: "list", TEXTAREA: "field", SUMMARY: "button", LABEL: "option" })[el.tagName] ||
    (el.tagName === "INPUT" ? (["submit", "button"].includes(el.type) ? "button" : el.type === "checkbox" || el.type === "radio" ? el.type : "field") : el.tagName.toLowerCase());
  const describe = (el) => kindOf(el) + ' "' + nameOf(el) + '"';
  const typing = (el) => el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["submit", "button", "checkbox", "radio", "file", "hidden", "image", "reset"].includes(el.type));
  const secret = new WeakSet();
  const markSecret = () => document.querySelectorAll("input[type=password]").forEach((el) => secret.add(el));
  markSecret();
  const private_ = (el) => secret.has(el) || el.type === "password" || /one-time-code|cc-|password/.test(el.autocomplete || "");
  const sent = new WeakMap();
  const typed = (el) => {
    if (sent.get(el) === el.value) return;
    sent.set(el, el.value);
    send(private_(el) ? { kind: "type", target: describe(el) } : { kind: "type", target: describe(el), text: String(el.value).slice(0, 200) });
  };
  addEventListener("pointerdown", markSecret, true);
  addEventListener("click", (event) => {
    const el = event.target instanceof Element && event.target.closest("a, button, input, select, textarea, summary, label, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=checkbox], [role=radio], [role=switch]");
    if (!el || event.detail === 0 || typing(el) || el.tagName === "SELECT") return;
    send({ kind: "click", target: describe(el) });
  }, true);
  addEventListener("change", (event) => {
    const el = event.target;
    if (!(el instanceof Element)) return;
    if (el.tagName === "SELECT") send({ kind: "choose", target: describe(el), option: words(el.selectedOptions[0] && el.selectedOptions[0].innerText) || words(el.value) });
    else if (typing(el)) typed(el);
  }, true);
  addEventListener("keydown", (event) => {
    markSecret();
    if (event.key !== "Enter" || event.isComposing) return;
    if (event.target instanceof Element && typing(event.target)) typed(event.target);
    send({ kind: "press", key: "Enter" });
  }, true);
})()`;

const recorders = new WeakMap<BrowserContext, string>();

const record = (session: Session, step: TaughtStep) => {
  const steps = session.teaching;
  if (!steps || steps.length >= MAX_STEPS) return;
  if (step.kind === "open" && steps.at(-1)?.kind === "open") steps.pop();
  steps.push(step);
};

const installed = (page: Page, script: string) =>
  page.evaluate(script, undefined, undefined, false).catch(() => undefined);

const recorderOf = async (session: Session) => {
  const { context } = session;
  const known = recorders.get(context);
  if (known) return known;
  const binding = `__t${randomUUID().replaceAll("-", "")}`;
  await context.exposeBinding(binding, (_source, step) => {
    const parsed = taughtStep.safeParse(step).data;
    if (parsed) record(session, parsed);
  });
  const script = recorder(binding);
  const watch = (page: Page) =>
    page.on("framenavigated", (frame) => {
      if (frame !== page.mainFrame() || !session.teaching) return;
      record(session, { kind: "open", url: frame.url() });
      void installed(page, script);
    });
  for (const page of context.pages()) watch(page);
  context.on("page", watch);
  recorders.set(context, script);
  return script;
};

export const startTeaching = async (session: Session) => {
  const script = await recorderOf(session);
  session.teaching = [{ kind: "open", url: session.page.url() }];
  await Promise.all(session.context.pages().map((page) => installed(page, script)));
};

export const stopTeaching = (session: Session, secrets: string[]) => {
  const steps = session.teaching ?? [];
  session.teaching = undefined;
  return z
    .array(taughtStep)
    .parse(steps.map((step) => JSON.parse(masked(JSON.stringify(step), secrets))));
};
