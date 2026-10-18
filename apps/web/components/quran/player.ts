import { api } from "@/lib/trpc";
import { z } from "zod";
import { create } from "zustand";

const TARTEEL = "https://audio-cdn.tarteel.ai/quran";

export const RECITERS = [
  {
    id: "Alafasy_128kbps",
    name: "Mishary Alafasy",
    audio: `${TARTEEL}/alafasy`,
    timings: 118,
  },
  {
    id: "Abdul_Basit_Murattal_192kbps",
    name: "Abdul Basit (Murattal)",
    audio: `${TARTEEL}/abdulBasitMurattal`,
    timings: 115,
  },
  {
    id: "Abdul_Basit_Mujawwad_128kbps",
    name: "Abdul Basit (Mujawwad)",
    audio: `${TARTEEL}/abdulBasitMujawwad`,
    timings: 114,
  },
  {
    id: "Husary_128kbps",
    name: "Mahmoud Khalil Al-Husary",
    audio: `${TARTEEL}/husary`,
    timings: 112,
  },
  {
    id: "Minshawy_Murattal_128kbps",
    name: "Muhammad Siddiq Al-Minshawi",
    audio: `${TARTEEL}/minshawyMurattal`,
    timings: 108,
  },
  {
    id: "Abdurrahmaan_As-Sudais_192kbps",
    name: "Abdurrahman As-Sudais",
    audio: `${TARTEEL}/abdulrahmanAlSudais`,
    timings: 116,
  },
  {
    id: "Saood_ash-Shuraym_128kbps",
    name: "Saud Ash-Shuraim",
    audio: `${TARTEEL}/saudAlShuraim`,
    timings: 107,
  },
  {
    id: "Maher_AlMuaiqly_64kbps",
    name: "Maher Al-Muaiqly",
    audio: `${TARTEEL}/maherAlMuaiqly`,
    timings: 113,
  },
  {
    id: "Ghamadi_40kbps",
    name: "Saad Al-Ghamdi",
    audio: `${TARTEEL}/ghamadi`,
    timings: 119,
  },
  {
    id: "Yasser_Ad-Dussary_128kbps",
    name: "Yasser Ad-Dossari",
    audio: `${TARTEEL}/yasserAlDosari`,
    timings: 103,
  },
  {
    id: "Hani_Rifai_192kbps",
    name: "Hani Ar-Rifai",
    audio: "https://audio.qurancdn.com/Rifai/mp3",
    timings: 104,
  },
  {
    id: "Muhammad_Ayyoub_128kbps",
    name: "Muhammad Ayyub",
    audio: "https://everyayah.com/data/Muhammad_Ayyoub_128kbps",
  },
] as const;

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

type Reciter = (typeof RECITERS)[number];
type ReciterId = Reciter["id"];
type Segment = [word: number, start: number, end: number];

export type Recitation = {
  surah: number;
  name: string;
  from: number;
  to: number;
  times?: number;
};

const STORAGE_KEY = "sirathicRecitation";

const saved = z.object({
  reciter: z.enum(RECITERS.map((reciter) => reciter.id)).catch(RECITERS[0].id),
  speed: z.union(SPEEDS.map((speed) => z.literal(speed))).catch(1),
});

const reciterOf = (id: ReciterId): Reciter =>
  RECITERS.find((reciter) => reciter.id === id) ?? RECITERS[0];

const audioUrl = (reciter: ReciterId, surah: number, ayah: number) =>
  `${reciterOf(reciter).audio}/${String(surah).padStart(3, "0")}${String(ayah).padStart(3, "0")}.mp3`;

export const reciterName = (id: ReciterId) => reciterOf(id).name;

type Player = {
  recitation: Recitation | undefined;
  ayah: number | undefined;
  word: number | undefined;
  loop: number;
  playing: boolean;
  progress: number;
  reciter: ReciterId;
  speed: (typeof SPEEDS)[number];
  repeat: boolean;
  load: () => void;
  play: (recitation: Recitation) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
  setReciter: (reciter: ReciterId) => void;
  cycleSpeed: () => void;
  toggleRepeat: () => void;
};

export const usePlayer = create<Player>()((set, get) => {
  let audio: HTMLAudioElement | undefined;
  let timings: { key: string; byAyah: Map<number, Segment[]> } | undefined;
  let frame = 0;

  const loadTimings = (surah: number) => {
    const reciter = reciterOf(get().reciter);
    const recitation = "timings" in reciter ? reciter.timings : undefined;
    const key = `${recitation}:${surah}`;
    if (timings?.key === key) return;
    timings = { key, byAyah: new Map() };
    if (recitation === undefined) return;
    api.quran.timings.query({ recitation, surah }).then(
      (rows) => {
        if (timings?.key === key)
          timings = {
            key,
            byAyah: new Map(rows.map((row) => [row.ayah, row.segments])),
          };
      },
      () => undefined,
    );
  };

  const track = () => {
    const { ayah, word } = get();
    const time = (audio?.currentTime ?? 0) * 1000;
    const current = (
      ayah === undefined ? [] : (timings?.byAyah.get(ayah) ?? [])
    ).reduce<number | undefined>(
      (found, [index, start]) => (start <= time ? index : found),
      undefined,
    );
    if (current !== word) set({ word: current });
    frame = requestAnimationFrame(track);
  };

  const persist = () => {
    const { reciter, speed } = get();
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ reciter, speed }),
    );
  };

  const element = () => {
    if (audio) return audio;
    audio = new Audio();
    audio.addEventListener("timeupdate", () => {
      if (audio?.duration)
        set({ progress: audio.currentTime / audio.duration });
    });
    audio.addEventListener("ended", () => {
      const { recitation, ayah, repeat, loop } = get();
      if (!recitation || ayah === undefined) return;
      if (repeat) start(ayah);
      else if (ayah < recitation.to) start(ayah + 1);
      else if (loop < (recitation.times ?? 1)) {
        set({ loop: loop + 1 });
        start(recitation.from);
      } else set({ playing: false, progress: 1 });
    });
    audio.addEventListener("pause", () => {
      cancelAnimationFrame(frame);
      set({ playing: false });
    });
    audio.addEventListener("play", () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(track);
      set({ playing: true });
    });
    return audio;
  };

  const announce = (recitation: Recitation, ayah: number) => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${recitation.name} ${recitation.surah}:${ayah}`,
      artist: reciterName(get().reciter),
      album: "Quran",
    });
    navigator.mediaSession.setActionHandler("play", () => get().toggle());
    navigator.mediaSession.setActionHandler("pause", () => get().toggle());
    navigator.mediaSession.setActionHandler("nexttrack", () => get().next());
    navigator.mediaSession.setActionHandler("previoustrack", () =>
      get().previous(),
    );
  };

  const start = (ayah: number) => {
    const { recitation, reciter, speed } = get();
    if (!recitation) return;
    const player = element();
    loadTimings(recitation.surah);
    player.src = audioUrl(reciter, recitation.surah, ayah);
    player.playbackRate = speed;
    set({ ayah, word: undefined, progress: 0 });
    announce(recitation, ayah);
    player.play().catch(() => set({ playing: false }));
  };

  return {
    recitation: undefined,
    ayah: undefined,
    word: undefined,
    loop: 1,
    playing: false,
    progress: 0,
    reciter: RECITERS[0].id,
    speed: 1,
    repeat: false,
    load: () => {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      const parsed = saved.safeParse(raw ? JSON.parse(raw) : {});
      if (parsed.success) set(parsed.data);
    },
    play: (recitation) => {
      set({ recitation, loop: 1 });
      start(recitation.from);
    },
    toggle: () => {
      const { ayah, recitation } = get();
      if (!audio || ayah === undefined || !recitation) return;
      if (!audio.paused) audio.pause();
      else if (get().progress >= 1) start(recitation.from);
      else audio.play().catch(() => set({ playing: false }));
    },
    next: () => {
      const { ayah, recitation } = get();
      if (ayah !== undefined && recitation && ayah < recitation.to) {
        start(ayah + 1);
      }
    },
    previous: () => {
      const { ayah, recitation } = get();
      if (ayah !== undefined && recitation && ayah > recitation.from) {
        start(ayah - 1);
      }
    },
    stop: () => {
      audio?.pause();
      set({
        recitation: undefined,
        ayah: undefined,
        word: undefined,
        progress: 0,
      });
    },
    setReciter: (reciter) => {
      set({ reciter });
      persist();
      const { ayah, playing } = get();
      if (ayah !== undefined && playing) start(ayah);
    },
    cycleSpeed: () => {
      const { speed } = get();
      const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
      set({ speed: next });
      persist();
      if (audio) audio.playbackRate = next;
    },
    toggleRepeat: () => set({ repeat: !get().repeat }),
  };
});
