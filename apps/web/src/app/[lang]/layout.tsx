import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { AppSync } from "@/components/appSync";
import { CookieNotice } from "@/components/cookieNotice";
import { I18nProvider } from "@/components/i18n";
import { hasLocale, isRtl, LOCALES } from "@/components/locales";
import { themeScript } from "@/components/preferences";
import { SITE } from "@/lib/seo";
import { getDictionary, translator } from "./dictionaries";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export async function generateMetadata({
  params,
}: Pick<LayoutProps<"/[lang]">, "params">): Promise<Metadata> {
  const { t } = await translator((await params).lang);
  const description = t(
    "Free Islamic answering engine. Answers come from the Quran, graded hadith and scholars' rulings, and cite their sources.",
  );
  return {
    metadataBase: new URL(SITE),
    title: { default: "Sirathic", template: "%s · Sirathic" },
    description,
    openGraph: { type: "website", siteName: "Sirathic", title: "Sirathic", description },
    twitter: { card: "summary", site: "@sirathic", title: "Sirathic", description },
  };
}

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const messages = await getDictionary(lang);

  return (
    <html
      lang={lang}
      dir={isRtl(lang) ? "rtl" : "ltr"}
      suppressHydrationWarning
      className={`${inter.variable} dark h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={lang} messages={messages}>
          <AppSync />
          {children}
          <CookieNotice />
        </I18nProvider>
      </body>
    </html>
  );
}
