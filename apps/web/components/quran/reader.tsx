"use client";

import { useLocalePath, useT } from "@/components/i18n";
import type { MessageKey } from "@/messages/en";
import { saveLastRead } from "@/components/quran/last-read";
import { usePlayer } from "@/components/quran/player";
import { PlayerBar } from "@/components/quran/player-bar";
import {
  byEnglishName,
  flagOf,
  nativeName,
  pickTafsirLanguage,
  preferredLanguage,
  type TafsirLanguage,
  useTafsirLanguage,
} from "@/components/quran/tafsir-language";
import {
  loadTranslation,
  MEMORIZE_MODES,
  type MemorizeMode,
  type TranslationText,
  useReading,
} from "@/components/quran/reading";
import {
  loadWordHelp,
  useWordHelp,
  type WordHelp,
} from "@/components/quran/word-help";
import { WordSheet } from "@/components/quran/word-sheet";
import { ThreadShell } from "@/components/thread-shell";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShowArabic } from "@/components/verse-cards";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpenTextIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  GlobeIcon,
  ListIcon,
  PauseIcon,
  PlayIcon,
  Share2Icon,
  TypeIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createElement,
  type FC,
  Fragment,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { z } from "zod";

type SurahText = Awaited<ReturnType<typeof api.quran.surah.query>>;
type Surah = SurahText["surah"];
type Ayah = SurahText["ayahs"][number];
type TranslationInfo = Awaited<
  ReturnType<typeof api.quran.index.query>
>["translations"][number];
type Translated = { text: string; notes: Map<string, string> };
type TafsirBook = Awaited<
  ReturnType<typeof api.quran.index.query>
>["tafsirs"][number];
type TafsirText = Awaited<ReturnType<typeof api.quran.tafsirText.query>>;
type Tafsir = Awaited<ReturnType<typeof api.quran.tafsir.query>>;

const ARABIC_SIZES = ["text-xl", "text-2xl", "text-3xl", "text-4xl"] as const;
const SIZE_NAMES = [
  "Small",
  "Medium",
  "Large",
  "Extra large",
] as const satisfies readonly MessageKey[];
const PARTIAL_BELOW = 6000;
const REPEAT_TIMES = [1, 2, 3, 5, 10, 20] as const;
const graphemes = new Intl.Segmenter("ar", { granularity: "grapheme" });

const firstLetter = (text: string) => {
  const letters = [...graphemes.segment(text.replace(/^۞\s*/u, ""))].map(
    (part) => part.segment,
  );
  const article =
    /^[ٱا]/u.test(letters[0] ?? "") && letters[1]?.startsWith("ل");
  return letters.slice(0, article ? 3 : 1).join("");
};
const SIZE_KEY = "sirathicQuranSize";
const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
const arabicDigits = new Intl.NumberFormat("ar-EG");
const savedSize = z.coerce
  .number()
  .int()
  .min(0)
  .max(ARABIC_SIZES.length - 1);

let quranIndex: ReturnType<typeof api.quran.index.query> | undefined;
const loadIndex = () => (quranIndex ??= api.quran.index.query());

const arabicOf = (surah: number, ayah: Ayah) =>
  surah !== 1 &&
  ayah.ayah === 1 &&
  ayah.textAr.normalize("NFC").startsWith(BISMILLAH.normalize("NFC"))
    ? ayah.textAr.slice(BISMILLAH.length).trim()
    : ayah.textAr;

const marker = (ayah: number) => `۝${arabicDigits.format(ayah)}`;

const footnotesOf = (text: string | null) =>
  new Map(
    [...(text ?? "").matchAll(/\[(\d+)\]\s*([^[]*)/gu)].map(([, n, note]) => [
      n ?? "",
      note?.trim() ?? "",
    ]),
  );

const Words: FC<{
  surah: number;
  ayah: number;
  words: string[];
  interactive?: boolean;
  meanings?: string[];
  memorize?: MemorizeMode;
}> = ({
  surah,
  ayah,
  words,
  interactive = false,
  meanings,
  memorize = "off",
}) => {
  const t = useT();
  const current = usePlayer((state) =>
    state.recitation?.surah === surah && state.ayah === ayah
      ? state.word
      : undefined,
  );
  const select = useWordHelp((state) => state.select);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  return words.map((text, index) => {
    const lit = current === index + 1 && "text-super";
    const hidden =
      memorize !== "off" && !revealed.has(index) && current !== index + 1;
    const shown =
      hidden && memorize === "first" ? (
        <>
          {firstLetter(text)}
          <span className="text-muted-foreground">…</span>
        </>
      ) : (
        text
      );
    const word = interactive ? (
      <button
        type="button"
        onClick={() =>
          hidden
            ? setRevealed(new Set([...revealed, index]))
            : select({ surah, ayah, index: index + 1, text })
        }
        aria-label={hidden ? t("Reveal word") : undefined}
        className={cn(
          "hover:bg-muted rounded-md transition-[color,filter] duration-150",
          hidden && memorize === "hide" && "blur-[7px] select-none",
          lit,
        )}
      >
        {shown}
      </button>
    ) : (
      <span className={cn("transition-colors duration-150", lit)}>{text}</span>
    );
    return (
      <Fragment key={index}>
        {index > 0 && " "}
        {meanings ? (
          <span className="inline-flex flex-col items-center gap-2 px-1.5 pb-3 align-top leading-[2.2]">
            {word}
            <span
              dir="auto"
              className="text-muted-foreground max-w-36 text-center font-sans text-xs leading-4"
            >
              {meanings[index]}
            </span>
          </span>
        ) : (
          word
        )}
      </Fragment>
    );
  });
};

const NumberPicker: FC<{
  label: string;
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  format?: (value: number) => string;
}> = ({ label, value, options, onChange, format = String }) => (
  <DropdownMenu>
    <DropdownMenuTrigger className="bg-muted flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{format(value)}</span>
      <ChevronDownIcon className="text-muted-foreground size-3.5" />
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-40">
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={String(value)}
        onValueChange={(next) => onChange(Number(next))}
      >
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option}
            value={String(option)}
            ref={option === value ? centered : undefined}
            className="tabular-nums"
          >
            {format(option)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

const MemorizeBar: FC<{ surah: Surah }> = ({ surah }) => {
  const t = useT();
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(5, surah.verseCount));
  const [times, setTimes] = useState(3);
  const verses = Array.from(
    { length: surah.verseCount },
    (_, index) => index + 1,
  );
  return (
    <section className="bg-card mt-4 flex flex-wrap items-center gap-2 rounded-2xl p-3">
      <NumberPicker
        label={t("From")}
        value={from}
        options={verses}
        onChange={(next) => {
          setFrom(next);
          if (to < next) setTo(next);
        }}
      />
      <NumberPicker
        label={t("To")}
        value={to}
        options={verses.filter((verse) => verse >= from)}
        onChange={setTo}
      />
      <NumberPicker
        label={t("Repeat")}
        value={times}
        options={REPEAT_TIMES}
        onChange={setTimes}
        format={(value) => `${value}×`}
      />
      <button
        type="button"
        onClick={() =>
          usePlayer.getState().play({
            surah: surah.number,
            name: surah.nameTranslit,
            from,
            to,
            times,
          })
        }
        className="bg-primary text-primary-foreground ms-auto flex h-9 items-center gap-2 rounded-full px-4 text-sm font-[470]"
      >
        <PlayIcon className="size-3.5 fill-current" />
        {t("Start")}
      </button>
    </section>
  );
};

const centered = (node: HTMLElement | null) =>
  node?.scrollIntoView({ block: "center" });

const LanguageFlag: FC<{ language: string }> = ({ language }) => {
  const flag = flagOf(language);
  return flag ? (
    <img src={`/flags/${flag}.svg`} alt="" className="size-4 shrink-0" />
  ) : (
    <GlobeIcon className="text-muted-foreground size-4" />
  );
};

const iconButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors";

const Translation: FC<Translated> = ({ text, notes }) => {
  const [note, setNote] = useState<string>();
  const pieces = text.split(/\[(\d+)\]/u);

  return (
    <>
      <p dir="auto" className="text-foreground/90 mt-3 text-[15px] leading-7">
        {pieces.map((piece, i) =>
          i % 2 === 1 && notes.has(piece) ? (
            <button
              key={i}
              type="button"
              onClick={() => setNote(note === piece ? undefined : piece)}
              className="text-super px-0.5 align-super text-[10px] font-[560]"
            >
              {piece}
            </button>
          ) : (
            <span key={i}>{i % 2 === 1 ? `[${piece}]` : piece}</span>
          ),
        )}
      </p>
      {note && (
        <p className="bg-muted text-muted-foreground mt-2 rounded-lg p-3 text-sm leading-6">
          {notes.get(note)}
        </p>
      )}
    </>
  );
};

const RICH_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
]);

const richNode = (node: ChildNode, key: number): ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof Element)) return null;
  const children = Array.from(node.childNodes, richNode);
  const tag = node.tagName.toLowerCase();
  return RICH_TAGS.has(tag) ? (
    createElement(tag, { key }, ...children)
  ) : (
    <Fragment key={key}>{children}</Fragment>
  );
};

const RichText: FC<{ html: string }> = ({ html }) =>
  Array.from(
    new DOMParser().parseFromString(html, "text/html").body.childNodes,
    richNode,
  );

const ClassicalTafsir: FC<{
  surah: number;
  ayah: number;
  books: TafsirBook[];
}> = ({ surah, ayah, books }) => {
  const t = useT();
  const chosen = useReading((state) => state.tafsir);
  const setChosen = useReading((state) => state.setTafsir);
  const book = books.find((entry) => entry.id === chosen);
  const [text, setText] = useState<TafsirText | null>();

  useEffect(() => {
    setText(undefined);
    if (!book) return;
    let current = true;
    api.quran.tafsirText.query({ tafsir: book.id, surah, ayah }).then(
      (found) => {
        if (current) setText(found);
      },
      () => {
        if (current) setText(null);
      },
    );
    return () => {
      current = false;
    };
  }, [book, surah, ayah]);

  if (books.length === 0) return null;
  const range =
    text && text.fromAyah !== text.toAyah
      ? `${surah}:${text.fromAyah}–${text.toAyah}`
      : `${surah}:${ayah}`;
  return (
    <section className="border-border/50 flex flex-col gap-2 border-t pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="bg-muted flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm">
          {book ? book.name : t("More tafsir")}
          <ChevronDownIcon className="text-muted-foreground size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          <DropdownMenuLabel>{t("More tafsir")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(chosen ?? 0)}
            onValueChange={(value) => setChosen(Number(value) || undefined)}
          >
            <DropdownMenuRadioItem value="0">{t("None")}</DropdownMenuRadioItem>
            {books.map((entry) => (
              <DropdownMenuRadioItem
                key={entry.id}
                value={String(entry.id)}
                className="gap-2.5"
              >
                <LanguageFlag language={entry.lang} />
                <span className="flex min-w-0 flex-col">
                  <span>{entry.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {entry.author}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {book && text === undefined && (
        <p className="text-muted-foreground text-sm">{t("Loading…")}</p>
      )}
      {book && text === null && (
        <p className="text-muted-foreground text-sm">
          {t("No passage for this ayah.")}
        </p>
      )}
      {book && text && (
        <>
          <h4 className="text-muted-foreground text-xs">
            {book.name} · {range}
          </h4>
          <div
            dir="auto"
            lang={book.lang}
            className="text-lg leading-loose [&_h2]:mt-2 [&_h2]:font-[560] [&_h3]:font-[560] [&_p]:mb-3"
          >
            <RichText html={text.body} />
          </div>
        </>
      )}
    </section>
  );
};

const TafsirPanel: FC<{ surah: number; ayah: number }> = ({ surah, ayah }) => {
  const t = useT();
  const chosen = useTafsirLanguage((state) => state.chosen);
  const choose = useTafsirLanguage((state) => state.choose);
  const showArabic = useShowArabic();
  const [languages, setLanguages] = useState<TafsirLanguage[]>([]);
  const [tafsir, setTafsir] = useState<Tafsir>();
  const [failed, setFailed] = useState(false);
  const [commentary, setCommentary] = useState(false);
  const [books, setBooks] = useState<TafsirBook[]>([]);
  const language =
    languages.length > 0 ? pickTafsirLanguage(languages, chosen) : undefined;

  useEffect(() => {
    void loadIndex().then(
      (index) => {
        setLanguages(byEnglishName(index.tafsirLanguages));
        setBooks(index.tafsirs);
      },
      () => setFailed(true),
    );
  }, []);

  useEffect(() => {
    if (!language) return;
    let current = true;
    api.quran.tafsir.query({ surah, ayah, lang: language }).then(
      (found) => {
        if (current) setTafsir(found);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [surah, ayah, language]);

  if (failed) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        {t("The tafsir could not be loaded.")}
      </p>
    );
  }
  if (!tafsir || !language) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        {t("Loading tafsir…")}
      </p>
    );
  }
  const passage = tafsir.english;
  const range =
    passage && passage.fromAyah !== passage.toAyah
      ? `${surah}:${passage.fromAyah}–${passage.toAyah}`
      : `${surah}:${ayah}`;
  return (
    <div className="bg-card mt-3 flex flex-col gap-3 rounded-xl p-3">
      {tafsir.abridged ? (
        <p dir="auto" className="text-[15px] leading-7">
          {tafsir.abridged.body}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("No note in this language for this ayah.")}
        </p>
      )}
      <div className="flex items-center gap-3">
        <p className="text-muted-foreground min-w-0 flex-1 text-xs leading-5">
          {tafsir.abridged?.credit}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("Tafsir language")}
            className="bg-muted flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm"
          >
            <LanguageFlag language={language} />
            {nativeName(language)}
            <ChevronDownIcon className="text-muted-foreground size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("Tafsir language")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={language}
              onValueChange={(value) => {
                const next = languages.find((code) => code === value);
                if (next) choose(next);
              }}
            >
              {languages.map((code) => (
                <DropdownMenuRadioItem
                  key={code}
                  value={code}
                  ref={code === language ? centered : undefined}
                  className="gap-2.5"
                >
                  <LanguageFlag language={code} />
                  {nativeName(code)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {showArabic && tafsir.arabic && (
        <section>
          <h4 className="text-muted-foreground mb-1 text-xs">
            {t("Tafsir al-Muyassar")}
          </h4>
          <p dir="rtl" lang="ar" className="text-lg leading-loose">
            {tafsir.arabic}
          </p>
        </section>
      )}
      {passage && (
        <>
          <button
            type="button"
            onClick={() => setCommentary(!commentary)}
            aria-expanded={commentary}
            className="text-super self-start text-sm"
          >
            {commentary
              ? t("Hide commentary")
              : t("Read commentary on {range} →", { range })}
          </button>
          {commentary && (
            <section>
              <h4 className="text-muted-foreground mb-1 text-xs">
                Tazkirul Quran · {range}
              </h4>
              <p className="text-sm leading-6 whitespace-pre-line">
                {passage.body}
              </p>
            </section>
          )}
        </>
      )}
      <ClassicalTafsir surah={surah} ayah={ayah} books={books} />
    </div>
  );
};

const VerseRow: FC<{
  surah: Surah;
  ayah: Ayah;
  size: number;
  current: boolean;
  playing: boolean;
  meanings?: string[];
  translated: Translated;
  transliteration?: string;
}> = ({
  surah,
  ayah,
  size,
  current,
  playing,
  meanings,
  translated,
  transliteration,
}) => {
  const t = useT();
  const [tafsir, setTafsir] = useState(false);
  const [copied, setCopied] = useState(false);
  const memorize = useReading((state) => state.memorize);
  const reference = `Quran ${surah.number}:${ayah.ayah}`;

  const copy = () => {
    void navigator.clipboard
      .writeText(
        `${arabicOf(surah.number, ayah)}\n\n${ayah.textEn} (${reference})`,
      )
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2_000);
      });
  };

  const share = () => {
    const url = `${window.location.origin}/quran/${surah.number}?ayah=${ayah.ayah}`;
    if (navigator.share) {
      void navigator.share({ title: reference, url }).catch(() => undefined);
    } else void navigator.clipboard.writeText(url);
  };

  const play = () => {
    const player = usePlayer.getState();
    if (current) player.toggle();
    else {
      player.play({
        surah: surah.number,
        name: surah.nameTranslit,
        from: ayah.ayah,
        to: surah.verseCount,
      });
    }
    saveLastRead({
      surah: surah.number,
      ayah: ayah.ayah,
      name: surah.nameTranslit,
    });
  };

  return (
    <article
      id={`ayah-${ayah.ayah}`}
      className={cn(
        "border-border/50 -mx-3 scroll-mt-4 border-b px-3 py-5 transition-colors",
        current && "bg-super/10 rounded-xl border-transparent",
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1">
        <span className="me-1 min-w-9 text-sm tabular-nums">
          {surah.number}:{ayah.ayah}
        </span>
        <button
          type="button"
          onClick={play}
          aria-label={current && playing ? t("Pause") : t("Play from here")}
          className={iconButton}
        >
          {current && playing ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label={t("Copy ayah")}
          className={iconButton}
        >
          {copied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={share}
          aria-label={t("Share ayah")}
          className={iconButton}
        >
          <Share2Icon className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setTafsir(!tafsir)}
          aria-pressed={tafsir}
          className={cn(
            "hover:bg-muted hover:text-foreground flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors",
            tafsir && "text-foreground bg-muted",
          )}
        >
          <BookOpenTextIcon className="size-4" />
          {t("Tafsir")}
        </button>
      </div>
      <p
        dir="rtl"
        lang="ar"
        className={cn(ARABIC_SIZES[size], "mt-4 leading-[2.3]")}
      >
        {ayah.words ? (
          <Words
            key={memorize}
            surah={surah.number}
            ayah={ayah.ayah}
            words={ayah.words}
            meanings={meanings}
            memorize={memorize}
            interactive
          />
        ) : (
          arabicOf(surah.number, ayah)
        )}{" "}
        <span className="text-super">{marker(ayah.ayah)}</span>
      </p>
      {transliteration && (
        <p className="text-muted-foreground mt-2 text-[15px] leading-7 italic">
          {transliteration}
        </p>
      )}
      <Translation text={translated.text} notes={translated.notes} />
      {tafsir && <TafsirPanel surah={surah.number} ayah={ayah.ayah} />}
    </article>
  );
};

const ReadingText: FC<{
  surah: Surah;
  ayahs: Ayah[];
  size: number;
  current: number | undefined;
}> = ({ surah, ayahs, size, current }) => (
  <p
    dir="rtl"
    lang="ar"
    className={cn(ARABIC_SIZES[size], "text-justify leading-[2.6]")}
  >
    {ayahs.map((ayah) => (
      <span
        key={ayah.ayah}
        id={`ayah-${ayah.ayah}`}
        role="button"
        tabIndex={0}
        onClick={() =>
          usePlayer.getState().play({
            surah: surah.number,
            name: surah.nameTranslit,
            from: ayah.ayah,
            to: surah.verseCount,
          })
        }
        className={cn(
          "rounded-md transition-colors",
          current === ayah.ayah && "bg-super/15",
        )}
      >
        {ayah.words ? (
          <Words surah={surah.number} ayah={ayah.ayah} words={ayah.words} />
        ) : (
          arabicOf(surah.number, ayah)
        )}{" "}
        <span className="text-super">{marker(ayah.ayah)}</span>{" "}
      </span>
    ))}
  </p>
);

const ModeButton: FC<{
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}> = ({ active, label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    aria-label={label}
    title={label}
    className={cn(
      "flex size-8 items-center justify-center rounded-full transition-colors",
      active
        ? "bg-foreground/10 text-foreground"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    {children}
  </button>
);

export const Reader: FC<{ number: number }> = ({ number }) => {
  const t = useT();
  const href = useLocalePath();
  const router = useRouter();
  const [text, setText] = useState<SurahText>();
  const [failed, setFailed] = useState(false);
  const [list, setList] = useState<Surah[]>([]);
  const [translationList, setTranslationList] = useState<TranslationInfo[]>([]);
  const translation = useReading((state) => state.translation);
  const transliterationOn = useReading((state) => state.transliteration);
  const setTranslation = useReading((state) => state.setTranslation);
  const setTransliteration = useReading((state) => state.setTransliteration);
  const memorize = useReading((state) => state.memorize);
  const setMemorize = useReading((state) => state.setMemorize);
  const [translationRows, setTranslationRows] = useState<TranslationText>();
  const [transliterationRows, setTransliterationRows] =
    useState<TranslationText>();
  const [mode, setMode] = useState<"verses" | "reading">("verses");
  const [size, setSize] = useState(1);
  const byWord = useWordHelp((state) => state.byWord);
  const setByWord = useWordHelp((state) => state.setByWord);
  const chosenLanguage = useTafsirLanguage((state) => state.chosen);
  const [help, setHelp] = useState<WordHelp>();
  const current = usePlayer((s) =>
    s.recitation?.surah === number ? s.ayah : undefined,
  );
  const playing = usePlayer((s) => s.playing);

  useEffect(() => {
    usePlayer.getState().load();
    useWordHelp.getState().load();
    useReading.getState().load();
    setSize(savedSize.catch(1).parse(localStorage.getItem(SIZE_KEY) ?? 1));
    void loadIndex().then(
      (index) => {
        setList(index.surahs);
        setTranslationList(index.translations);
      },
      () => undefined,
    );
  }, []);

  useEffect(() => {
    let active = true;
    setText(undefined);
    api.quran.surah.query({ number }).then(
      (found) => {
        if (active) setText(found);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [number]);

  useEffect(() => {
    if (!text) return;
    const ayah = Number(
      new URLSearchParams(window.location.search).get("ayah"),
    );
    if (ayah > 1) {
      document
        .getElementById(`ayah-${ayah}`)
        ?.scrollIntoView({ block: "start" });
    }
    saveLastRead({
      surah: text.surah.number,
      ayah: ayah > 0 ? ayah : 1,
      name: text.surah.nameTranslit,
    });
  }, [text]);

  useEffect(() => {
    if (current === undefined || !playing) return;
    document
      .getElementById(`ayah-${current}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current, playing]);

  useEffect(() => {
    setHelp(undefined);
    if (!byWord) return;
    let active = true;
    loadWordHelp(number, preferredLanguage(chosenLanguage)).then(
      (found) => {
        if (active) setHelp(found);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [byWord, number, chosenLanguage]);

  const transliterationId = translationList.find(
    (entry) => entry.kind === "transliteration",
  )?.id;

  useEffect(() => {
    setTranslationRows(undefined);
    if (translation === undefined) return;
    let active = true;
    loadTranslation(translation, number).then(
      (rows) => {
        if (active) setTranslationRows(rows);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [translation, number]);

  useEffect(() => {
    setTransliterationRows(undefined);
    if (!transliterationOn || transliterationId === undefined) return;
    let active = true;
    loadTranslation(transliterationId, number).then(
      (rows) => {
        if (active) setTransliterationRows(rows);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [transliterationOn, transliterationId, number]);

  const translatedOf = (ayah: Ayah): Translated => {
    if (translation === undefined || !translationRows)
      return { text: ayah.textEn, notes: footnotesOf(ayah.footnotesEn) };
    const row = translationRows.find((entry) => entry.ayah === ayah.ayah);
    return row
      ? {
          text: row.text,
          notes: new Map(
            (row.footnotes ?? []).map((note, index) => [
              String(index + 1),
              note,
            ]),
          ),
        }
      : {
          text: t("This translation does not cover this ayah."),
          notes: new Map(),
        };
  };
  const transliterationOf = (ayah: number) =>
    transliterationRows?.find((entry) => entry.ayah === ayah)?.text;
  const chosenTranslation = translationList.find(
    (entry) => entry.id === translation,
  );
  const translationGroups = Map.groupBy(
    translationList
      .filter((entry) => entry.kind === "translation")
      .toSorted((a, b) => Number(b.lang === "en") - Number(a.lang === "en")),
    (entry) => entry.lang,
  );

  const meaningsOf = new Map(
    help ? help.ayahs.map((row) => [row.ayah, row.meanings]) : [],
  );

  const changeSize = (next: number) => {
    setSize(next);
    localStorage.setItem(SIZE_KEY, String(next));
  };

  const surah = text?.surah;

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="flex h-full flex-col">
          <header className="border-border/50 flex h-14 shrink-0 items-center gap-1 border-b pe-3 ps-14 md:ps-6">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("Surah")}
                className="hover:bg-muted flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1.5 text-base font-[470]"
              >
                <span className="truncate">
                  {surah ? `${surah.number}. ${surah.nameTranslit}` : number}
                </span>
                <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72">
                <DropdownMenuLabel>{t("Surah")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={String(number)}
                  onValueChange={(value) =>
                    router.push(href(`/quran/${value}`))
                  }
                >
                  {list.map((entry) => (
                    <DropdownMenuRadioItem
                      key={entry.number}
                      value={String(entry.number)}
                      ref={entry.number === number ? centered : undefined}
                      className="gap-3"
                    >
                      <span className="text-muted-foreground w-6 shrink-0 text-end text-xs tabular-nums">
                        {entry.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {entry.nameTranslit}
                      </span>
                      <span lang="ar" className="text-muted-foreground">
                        {entry.nameAr}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="ms-auto flex items-center gap-1">
              <ModeButton
                active={mode === "verses"}
                label={t("Verse by verse")}
                onClick={() => setMode("verses")}
              >
                <ListIcon className="size-4" />
              </ModeButton>
              <ModeButton
                active={mode === "reading"}
                label={t("Reading")}
                onClick={() => setMode("reading")}
              >
                <BookOpenTextIcon className="size-4" />
              </ModeButton>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("Reading settings")}
                  title={t("Reading settings")}
                  className={iconButton}
                >
                  <TypeIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t("Arabic size")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={String(size)}
                    onValueChange={(value) => changeSize(Number(value))}
                  >
                    {SIZE_NAMES.map((name, index) => (
                      <DropdownMenuRadioItem key={name} value={String(index)}>
                        {t(name)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2.5">
                      <LanguageFlag
                        language={chosenTranslation?.lang ?? "en"}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-muted-foreground text-xs">
                          {t("Translation")}
                        </span>
                        <span className="truncate">
                          {chosenTranslation?.name ?? "Saheeh International"}
                        </span>
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-(--radix-dropdown-menu-content-available-height) w-72 overflow-y-auto">
                      <DropdownMenuRadioGroup
                        value={String(translation ?? 0)}
                        onValueChange={(value) =>
                          setTranslation(Number(value) || undefined)
                        }
                      >
                        {[...translationGroups].map(([lang, entries]) => (
                          <Fragment key={lang}>
                            <DropdownMenuLabel className="flex items-center gap-2 pt-2">
                              <LanguageFlag language={lang} />
                              {nativeName(lang)}
                            </DropdownMenuLabel>
                            {lang === "en" && (
                              <DropdownMenuRadioItem value="0">
                                Saheeh International
                              </DropdownMenuRadioItem>
                            )}
                            {entries.map((entry) => (
                              <DropdownMenuRadioItem
                                key={entry.id}
                                value={String(entry.id)}
                              >
                                {entry.name}
                                {entry.verses < PARTIAL_BELOW && (
                                  <span className="text-muted-foreground">
                                    · partial
                                  </span>
                                )}
                              </DropdownMenuRadioItem>
                            ))}
                          </Fragment>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuCheckboxItem
                    checked={transliterationOn}
                    onCheckedChange={setTransliteration}
                  >
                    {t("Transliteration")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={byWord}
                    onCheckedChange={setByWord}
                  >
                    {t("Word by word")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("Memorize")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={memorize}
                    onValueChange={(value) => {
                      const next = MEMORIZE_MODES.find(
                        (option) => option === value,
                      );
                      if (next) setMemorize(next);
                    }}
                  >
                    <DropdownMenuRadioItem value="off">
                      {t("Off")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="hide">
                      {t("Hide words")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="first">
                      {t("First letters")}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[720px] px-6 pt-4 pb-16">
              {failed && (
                <p className="text-muted-foreground text-sm">
                  {t("This surah could not be loaded. Try again later.")}
                </p>
              )}
              {surah && text && (
                <>
                  <section className="bg-card flex flex-col gap-3 rounded-2xl p-4">
                    <div className="flex items-center gap-4">
                      <span lang="ar" className="text-4xl leading-tight">
                        {surah.nameAr}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-lg font-[560]">
                          {surah.number}. {surah.nameTranslit}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {surah.nameEn} ·{" "}
                          {surah.revelation === "meccan"
                            ? t("Meccan")
                            : t("Medinan")}{" "}
                          · {t("{count} ayahs", { count: surah.verseCount })}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        usePlayer.getState().play({
                          surah: surah.number,
                          name: surah.nameTranslit,
                          from: 1,
                          to: surah.verseCount,
                        })
                      }
                      className="bg-primary text-primary-foreground flex h-9 w-fit items-center gap-2 rounded-full px-4 text-sm font-[470]"
                    >
                      <PlayIcon className="size-3.5 fill-current" />
                      {t("Play surah")}
                    </button>
                  </section>
                  {surah.number !== 1 && surah.number !== 9 && (
                    <p
                      dir="rtl"
                      lang="ar"
                      className="mt-8 text-center text-2xl leading-loose"
                    >
                      {BISMILLAH}
                    </p>
                  )}
                  {mode === "verses" && memorize !== "off" && (
                    <MemorizeBar key={surah.number} surah={surah} />
                  )}
                  <div className="mt-4">
                    {mode === "verses" ? (
                      text.ayahs.map((ayah) => (
                        <VerseRow
                          key={ayah.ayah}
                          surah={surah}
                          ayah={ayah}
                          size={size}
                          current={current === ayah.ayah}
                          playing={playing}
                          meanings={meaningsOf.get(ayah.ayah)}
                          translated={translatedOf(ayah)}
                          transliteration={transliterationOf(ayah.ayah)}
                        />
                      ))
                    ) : (
                      <ReadingText
                        surah={surah}
                        ayahs={text.ayahs}
                        size={size}
                        current={current}
                      />
                    )}
                  </div>
                  <nav className="mt-8 flex justify-between gap-3 text-sm">
                    {surah.number > 1 ? (
                      <Link
                        href={href(`/quran/${surah.number - 1}`)}
                        className="hover:bg-muted flex items-center gap-1 rounded-lg px-2 py-1.5"
                      >
                        <ChevronLeftIcon className="size-4 rtl:rotate-180" />
                        {t("Previous surah")}
                      </Link>
                    ) : (
                      <span />
                    )}
                    {surah.number < 114 && (
                      <Link
                        href={href(`/quran/${surah.number + 1}`)}
                        className="hover:bg-muted flex items-center gap-1 rounded-lg px-2 py-1.5"
                      >
                        {t("Next surah")}
                        <ChevronRightIcon className="size-4 rtl:rotate-180" />
                      </Link>
                    )}
                  </nav>
                </>
              )}
            </div>
          </div>
          <PlayerBar />
          <WordSheet />
        </div>
      </ThreadShell>
    </main>
  );
};
