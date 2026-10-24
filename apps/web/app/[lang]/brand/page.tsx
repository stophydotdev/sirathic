"use client";

import { useLocalePath, useT } from "@/components/i18n";
import { Logo, Mark } from "@/components/logo";
import type { MessageKey } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { strToU8, zipSync } from "fflate";
import {
  IconArrowDown,
  IconCheck,
  IconCopy,
  IconDownload,
} from "@tabler/icons-react";
import Link from "next/link";
import { type FC, type ReactNode, useRef, useState } from "react";

const TEAL = "#20808d";
const TEAL_ON_DARK = "#4e99a3";
const INK = "#161616";
const PAPER = "#ffffff";
const SOFT = "#dedede";
const PNG_SIZE = 1200;

const LOGOS = [
  { file: "sirathic-logo-on-teal", tile: TEAL, mark: PAPER, text: PAPER },
  { file: "sirathic-logo-on-dark", tile: INK, mark: TEAL_ON_DARK, text: SOFT },
  { file: "sirathic-logo-on-light", tile: PAPER, mark: TEAL, text: INK },
  { file: "sirathic-logo-mono", tile: PAPER, mark: INK, text: INK },
];

const SYMBOLS = [
  { file: "sirathic-symbol-on-teal", tile: TEAL, color: PAPER },
  { file: "sirathic-symbol-on-dark", tile: INK, color: SOFT },
  { file: "sirathic-symbol-on-light", tile: PAPER, color: TEAL },
];

const COLORS = [
  {
    name: "Teal",
    hex: "#20808D",
    rgb: "rgb(32, 128, 141)",
    hsl: "hsl(187, 63%, 34%)",
    ink: PAPER,
  },
  {
    name: "Teal on dark",
    hex: "#4E99A3",
    rgb: "rgb(78, 153, 163)",
    hsl: "hsl(187, 35%, 47%)",
    ink: PAPER,
  },
  {
    name: "Ink",
    hex: "#161616",
    rgb: "rgb(22, 22, 22)",
    hsl: "hsl(0, 0%, 9%)",
    ink: SOFT,
  },
  {
    name: "Paper",
    hex: "#FFFFFF",
    rgb: "rgb(255, 255, 255)",
    hsl: "hsl(0, 0%, 100%)",
    ink: INK,
  },
] satisfies readonly {
  name: MessageKey;
  hex: string;
  rgb: string;
  hsl: string;
  ink: string;
}[];

const JUMPS = [
  { id: "wordmark", label: "Wordmark" },
  { id: "symbol", label: "Symbol" },
  { id: "colors", label: "Colors" },
] satisfies readonly { id: string; label: MessageKey }[];

const markup = (svg: SVGSVGElement) =>
  new XMLSerializer().serializeToString(svg);

const toPng = async (svg: SVGSVGElement) => {
  const { width, height } = svg.viewBox.baseVal;
  const scale = PNG_SIZE / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup(svg))}`;
  await image.decode();
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) =>
      blob ? resolve(blob) : reject(new Error("The PNG could not be made.")),
    ),
  );
};

const save = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
};

const zipEntries = async (
  tile: HTMLElement,
): Promise<[string, Uint8Array][]> => {
  const svg = tile.querySelector("svg");
  if (!svg) return [];
  const png = await toPng(svg);
  return [
    [`${tile.dataset.file}.svg`, strToU8(markup(svg))],
    [`${tile.dataset.file}.png`, new Uint8Array(await png.arrayBuffer())],
  ];
};

export default function Brand() {
  const assets = useRef<HTMLDivElement>(null);
  const [zipping, setZipping] = useState(false);
  const t = useT();
  const href = useLocalePath();

  const downloadAll = async () => {
    const tiles = assets.current?.querySelectorAll<HTMLElement>("[data-file]");
    if (!tiles) return;
    setZipping(true);
    const entries = await Promise.all([...tiles].map(zipEntries));
    save(
      new Blob([zipSync(Object.fromEntries(entries.flat())).slice()], {
        type: "application/zip",
      }),
      "sirathic-brand.zip",
    );
    setZipping(false);
  };

  return (
    <main className="min-h-dvh">
      <header className="border-border/60 flex items-center justify-between border-b px-5 py-3.5 md:px-10">
        <Link href={href("/")} className="text-foreground">
          <Logo height={20} />
        </Link>
        <Link
          href={href("/")}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {t("Back to Sirathic")}
        </Link>
      </header>

      <div className="border-border/60 mx-auto max-w-6xl md:border-x">
        <section className="border-border/60 border-b px-5 py-14 text-center md:py-16">
          <h1 className="text-4xl font-medium tracking-tight text-balance md:text-5xl">
            <span className="text-super">Sirathic</span> {t("Brand")}
          </h1>
          <p className="text-muted-foreground mt-3">
            {t("Logos, colors and guidelines for Sirathic.")}
          </p>
          <nav className="mt-6 flex flex-wrap justify-center gap-2.5">
            {JUMPS.map(({ id, label }) => (
              <Button key={id} variant="outline" size="lg" asChild>
                <a href={`#${id}`}>
                  {t(label)}
                  <IconArrowDown />
                </a>
              </Button>
            ))}
          </nav>
        </section>

        <div ref={assets}>
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-10 md:px-10">
            <div>
              <h2 className="text-3xl font-medium tracking-tight">
                {t("Brand assets")}
              </h2>
              <p className="text-muted-foreground mt-1.5">
                {t("Download our logos and follow the guidelines below.")}
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              disabled={zipping}
              onClick={downloadAll}
            >
              <IconDownload />
              {t("Download all brand assets")}
            </Button>
          </div>

          <Guide id="wordmark" title={t("Wordmark")}>
            {t(
              "The Sirathic wordmark is the rosette next to the name in capitals. Use it as the main logo in most places. Don't stretch, recolor or change it.",
            )}
          </Guide>
          <div className="border-border/60 grid gap-5 border-b px-5 pt-3 pb-10 sm:grid-cols-2 lg:grid-cols-3">
            {LOGOS.map(({ file, tile, mark, text }) => (
              <Asset key={file} file={file} tile={tile} downloadSvg>
                <Logo height={34} mark={mark} text={text} />
              </Asset>
            ))}
          </div>

          <Guide id="symbol" title={t("Symbol")}>
            {t(
              "The rosette is eight circles that each pass through the center, held inside a ring. Use it where the space is square or small, like app icons and profile pictures.",
            )}
          </Guide>
          <div className="border-border/60 grid gap-5 border-b px-5 pt-3 pb-10 sm:grid-cols-2 lg:grid-cols-3">
            {SYMBOLS.map(({ file, tile, color }) => (
              <Asset key={file} file={file} tile={tile} downloadSvg={false}>
                <Mark size={72} color={color} />
              </Asset>
            ))}
          </div>
        </div>

        <Guide id="colors" title={t("Colors")}>
          {t(
            "Teal is the accent, for links and highlights. Ink and Paper are the page colors of the dark and light themes. On Ink, use the lighter teal so it stays easy to read.",
          )}
        </Guide>
        <div className="grid grid-cols-2 gap-3 px-5 pt-3 pb-16 sm:gap-5 lg:grid-cols-4">
          {COLORS.map((color) => (
            <div key={color.name} className="flex flex-col gap-3">
              <div
                className="border-border flex aspect-[1.4] flex-col justify-center gap-1.5 rounded-2xl border px-4 sm:px-6"
                style={{ background: color.hex, color: color.ink }}
              >
                <span className="text-base font-medium sm:text-lg">
                  {t(color.name)}
                </span>
                <span className="text-xs leading-relaxed tabular-nums opacity-80 sm:text-sm">
                  {color.hex}
                  <br />
                  {color.rgb}
                  <br />
                  {color.hsl}
                </span>
              </div>
              <CopyButton label={t("Copy")} value={() => color.hex} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

const Guide: FC<{ id: string; title: string; children: ReactNode }> = ({
  id,
  title,
  children,
}) => (
  <div
    id={id}
    className="border-border/60 scroll-mt-4 border-b px-5 py-9 md:ps-[25%]"
  >
    <h3 className="mb-3 text-xl font-medium">{title}</h3>
    <p className="text-foreground/85 max-w-[52ch] leading-relaxed">
      {children}
    </p>
  </div>
);

const Asset: FC<{
  file: string;
  tile: string;
  downloadSvg: boolean;
  children: ReactNode;
}> = ({ file, tile, downloadSvg, children }) => {
  const preview = useRef<HTMLDivElement>(null);
  const svg = () => preview.current?.querySelector("svg") ?? undefined;
  const text = () => {
    const node = svg();
    return node ? markup(node) : undefined;
  };

  const download = async (format: "svg" | "png") => {
    const node = svg();
    if (!node) return;
    save(
      format === "svg"
        ? new Blob([markup(node)], { type: "image/svg+xml" })
        : await toPng(node),
      `${file}.${format}`,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={preview}
        data-file={file}
        className="border-border grid aspect-[1.4] place-items-center rounded-2xl border"
        style={{ background: tile }}
      >
        {children}
      </div>
      <div className="grid auto-cols-fr grid-flow-col gap-2">
        <CopyButton label="SVG" value={text} />
        {downloadSvg && (
          <Button
            variant="outline"
            className="h-9 rounded-full"
            onClick={() => download("svg")}
          >
            <IconDownload />
            SVG
          </Button>
        )}
        <Button
          variant="outline"
          className="h-9 rounded-full"
          onClick={() => download("png")}
        >
          <IconDownload />
          PNG
        </Button>
      </div>
    </div>
  );
};

const CopyButton: FC<{ label: string; value: () => string | undefined }> = ({
  label,
  value,
}) => {
  const [copied, setCopied] = useState(false);
  const t = useT();

  const copy = async () => {
    const text = value();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button variant="outline" className="h-9 rounded-full" onClick={copy}>
      {copied ? <IconCheck /> : <IconCopy />}
      {copied ? t("Copied") : label}
    </Button>
  );
};
