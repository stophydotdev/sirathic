import { usePlayer } from "@/components/quran/player";
import { api } from "@/lib/trpc";
import { create } from "zustand";

export type WordHelp = Awaited<ReturnType<typeof api.quran.words.query>>;

export type SelectedWord = {
  surah: number;
  ayah: number;
  index: number;
  text: string;
};

const BY_WORD_KEY = "sirathicWordByWord";
const loaded = new Map<string, Promise<WordHelp>>();

export const loadWordHelp = (surah: number, lang: string) => {
  const key = `${surah}:${lang}`;
  const known = loaded.get(key);
  if (known) return known;
  const pending = api.quran.words.query({ surah, lang });
  loaded.set(key, pending);
  pending.catch(() => loaded.delete(key));
  return pending;
};

const pad = (value: number) => String(value).padStart(3, "0");

export const playWord = ({ surah, ayah, index }: SelectedWord) => {
  const player = usePlayer.getState();
  if (player.playing) player.toggle();
  void new Audio(
    `https://audio.qurancdn.com/wbw/${pad(surah)}_${pad(ayah)}_${pad(index)}.mp3`,
  )
    .play()
    .catch(() => undefined);
};

export const useWordHelp = create<{
  selected?: SelectedWord;
  byWord: boolean;
  select: (word?: SelectedWord) => void;
  setByWord: (byWord: boolean) => void;
  load: () => void;
}>()((set) => ({
  byWord: false,
  select: (word) => set({ selected: word }),
  setByWord: (byWord) => {
    globalThis.localStorage?.setItem(BY_WORD_KEY, byWord ? "1" : "0");
    set({ byWord });
  },
  load: () =>
    set({ byWord: globalThis.localStorage?.getItem(BY_WORD_KEY) === "1" }),
}));
