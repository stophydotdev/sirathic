import Link from "next/link";
import type { FC, ReactNode } from "react";
import { Logo } from "@/components/logo";

export const CONTACT = "hussein@sirathic.com";

export const LegalPage: FC<{
  home: string;
  back: string;
  title: string;
  updated: string;
  children: ReactNode;
}> = ({ home, back, title, updated, children }) => (
  <main className="min-h-dvh">
    <header className="border-border/60 flex items-center justify-between border-b px-5 py-3.5 md:px-10">
      <Link href={home} className="text-foreground">
        <Logo height={20} />
      </Link>
      <Link href={home} className="text-muted-foreground hover:text-foreground text-sm">
        {back}
      </Link>
    </header>
    <article
      lang="en"
      dir="ltr"
      className="text-foreground/90 [&_a]:text-super [&_h2]:text-foreground mx-auto w-full max-w-[680px] px-5 pt-12 pb-20 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-medium [&_li]:leading-7 [&_p]:mt-4 [&_p]:leading-7 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:ps-5"
    >
      <h1 className="text-foreground text-3xl font-medium tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2! text-sm">Last updated {updated}</p>
      {children}
    </article>
  </main>
);
