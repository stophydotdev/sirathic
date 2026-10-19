"use client";

import { useLocalePath, useT } from "@/components/i18n";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/messages/en";
import Link from "next/link";
import { type FC, useSyncExternalStore } from "react";
import answer from "./answer.webp";
import { PlatformLogo } from "./logos";

export type System = "mac" | "windows" | "linux" | "phone" | "unknown";
type Desktop = Extract<System, "mac" | "windows" | "linux">;

const RELEASES = "https://download.sirathic.com";
const FILES = {
  macArm: `${RELEASES}/Sirathic-mac-arm64.dmg`,
  macIntel: `${RELEASES}/Sirathic-mac-x64.dmg`,
  windows: `${RELEASES}/Sirathic-windows.exe`,
  linuxX64: `${RELEASES}/Sirathic-linux-x86_64.AppImage`,
  linuxArm: `${RELEASES}/Sirathic-linux-arm64.AppImage`,
} as const;
const NAMES = { mac: "Mac", windows: "Windows", linux: "Linux" } as const;
const FILE_OF = {
  mac: FILES.macArm,
  windows: FILES.windows,
  linux: FILES.linuxX64,
} as const satisfies Record<Desktop, string>;

const TITLES = {
  mac: "Sirathic for Mac",
  windows: "Sirathic for Windows",
  linux: "Sirathic for Linux",
  phone: "Sirathic for desktop",
  unknown: "Sirathic for desktop",
} as const satisfies Record<System, MessageKey>;
const DOWNLOADS = {
  mac: "Download for Mac",
  windows: "Download for Windows",
  linux: "Download for Linux",
} as const satisfies Record<Desktop, MessageKey>;

const noSubscription = () => () => {};

const useShownSystem = (system: System): System => {
  const touchMac = useSyncExternalStore(
    noSubscription,
    () => system === "mac" && navigator.maxTouchPoints > 1,
    () => false,
  );
  return touchMac ? "phone" : system;
};

const pill = "h-10 rounded-full px-5";
const link =
  "decoration-border hover:text-foreground underline underline-offset-4";

const Primary: FC<{ system: Desktop; href: string }> = ({ system, href }) => {
  const t = useT();
  return (
    <Button asChild className={pill}>
      <a href={href}>
        <PlatformLogo system={system} />
        {t(DOWNLOADS[system])}
      </a>
    </Button>
  );
};

const Choices: FC<{ links: readonly (readonly [string, string])[] }> = ({
  links,
}) => (
  <p className="text-muted-foreground flex gap-3.5 text-sm">
    {links.map(([label, href]) => (
      <a key={label} href={href} className={link}>
        {label}
      </a>
    ))}
  </p>
);

const AlsoOn: FC<{ others: readonly [Desktop, Desktop] }> = ({ others }) => {
  const t = useT();
  const [first, second] = others;
  const sentence = t("Also on {first} and {second}.", {
    first: "{first}",
    second: "{second}",
  });
  return (
    <p className="text-muted-foreground text-sm">
      {sentence.split(/(\{first\}|\{second\})/u).map((part, index) => {
        const system =
          part === "{first}" ? first : part === "{second}" ? second : undefined;
        return system ? (
          <a key={system} href={FILE_OF[system]} className={link}>
            <PlatformLogo
              system={system}
              className="me-1 inline size-3.5 align-[-2px]"
            />
            {NAMES[system]}
          </a>
        ) : (
          <span key={index}>{part}</span>
        );
      })}{" "}
      {t("Free.")}
    </p>
  );
};

const Actions: FC<{ system: System; arm: boolean }> = ({ system, arm }) => {
  const t = useT();
  const href = useLocalePath();
  switch (system) {
    case "mac":
      return (
        <>
          <Primary system="mac" href={FILES.macArm} />
          <Choices
            links={[
              ["Apple Silicon", FILES.macArm],
              ["Intel", FILES.macIntel],
            ]}
          />
          <AlsoOn others={["windows", "linux"]} />
        </>
      );
    case "windows":
      return (
        <>
          <Primary system="windows" href={FILES.windows} />
          <AlsoOn others={["mac", "linux"]} />
        </>
      );
    case "linux":
      return (
        <>
          <Primary
            system="linux"
            href={arm ? FILES.linuxArm : FILES.linuxX64}
          />
          <Choices
            links={[
              ["x64", FILES.linuxX64],
              ["ARM", FILES.linuxArm],
            ]}
          />
          <AlsoOn others={["mac", "windows"]} />
        </>
      );
    case "phone":
      return (
        <>
          <Button asChild className={pill}>
            <Link href={href("/")}>{t("Open Sirathic")}</Link>
          </Button>
          <p className="text-muted-foreground max-w-sm text-sm">
            {t(
              "The desktop app runs on Mac, Windows and Linux. On a phone or tablet, use sirathic.com in your browser.",
            )}
          </p>
        </>
      );
    case "unknown":
      return (
        <>
          <div className="flex flex-wrap justify-center gap-2.5">
            {(["mac", "windows", "linux"] as const).map((desktop) => (
              <Button key={desktop} asChild variant="outline" className={pill}>
                <a href={FILE_OF[desktop]}>
                  <PlatformLogo system={desktop} />
                  {NAMES[desktop]}
                </a>
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">{t("Free.")}</p>
        </>
      );
    default: {
      const unknownSystem: never = system;
      return unknownSystem;
    }
  }
};

export const Download: FC<{ system: System; arm: boolean }> = ({
  system,
  arm,
}) => {
  const t = useT();
  const href = useLocalePath();
  const shown = useShownSystem(system);

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

      <section className="flex flex-col items-center gap-3.5 px-5 pt-14 text-center md:pt-16">
        <img src="/icon.svg" alt="" width={72} height={72} className="mb-1.5" />
        <h1 className="text-4xl font-medium tracking-tight text-balance md:text-5xl">
          {t(TITLES[shown])}
        </h1>
        <p className="text-muted-foreground mb-2.5 text-lg">
          {t("Islamic answering engine.")}
        </p>
        <Actions system={shown} arm={arm} />
      </section>

      <div className="mx-auto max-w-5xl px-5 pt-12 pb-20">
        <img
          src={answer.src}
          width={answer.width}
          height={answer.height}
          alt=""
          className="border-border w-full rounded-xl border"
        />
      </div>
    </main>
  );
};
