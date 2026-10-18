import { api } from "@/lib/trpc";
import { z } from "zod";
import { create } from "zustand";

export type TranslationText = Awaited<
  ReturnType<typeof api.quran.translation.query>
>;

const STORAGE_KEY = "sirathicReading";
export const MEMORIZE_MODES = ["off", "hide", "first"] as const;
export type MemorizeMode = (typeof MEMORIZE_MODES)[number];
const saved = z.object({
  translation: z.number().int().positive().optional().catch(undefined),
  transliteration: z.boolean().catch(false),
  memorize: z.enum(MEMORIZE_MODES).catch("off"),
  tafsir: z.number().int().positive().optional().catch(undefined),
});

const loaded = new Map<string, Promise<TranslationText>>();

export const loadTranslation = (translation: number, surah: number) => {
  const key = `${translation}:${surah}`;
  const known = loaded.get(key);
  if (known) return known;
  const pending = api.quran.translation.query({ translation, surah });
  loaded.set(key, pending);
  pending.catch(() => loaded.delete(key));
  return pending;
};

export const useReading = create<{
  translation?: number;
  transliteration: boolean;
  memorize: MemorizeMode;
  tafsir?: number;
  setTranslation: (translation?: number) => void;
  setTafsir: (tafsir?: number) => void;
  setTransliteration: (transliteration: boolean) => void;
  setMemorize: (memorize: MemorizeMode) => void;
  load: () => void;
}>()((set, get) => {
  const persist = () => {
    const { translation, transliteration, memorize, tafsir } = get();
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ translation, transliteration, memorize, tafsir }),
    );
  };
  return {
    transliteration: false,
    memorize: "off",
    setTafsir: (tafsir) => {
      set({ tafsir });
      persist();
    },
    setMemorize: (memorize) => {
      set({ memorize });
      persist();
    },
    setTranslation: (translation) => {
      set({ translation });
      persist();
    },
    setTransliteration: (transliteration) => {
      set({ transliteration });
      persist();
    },
    load: () => {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      const parsed = saved.safeParse(raw ? JSON.parse(raw) : {});
      if (parsed.success) set(parsed.data);
    },
  };
});
