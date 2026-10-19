const STORAGE_KEY = "sirathicDraft";

export function saveDraft(text: string) {
  globalThis.sessionStorage?.setItem(STORAGE_KEY, text);
}

export function takeDraft() {
  const text = globalThis.sessionStorage?.getItem(STORAGE_KEY);
  globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  return text || undefined;
}
