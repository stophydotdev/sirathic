import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { CookieNotice } from "@/components/cookieNotice";
import { I18nProvider } from "@/components/i18n";
import { hasLocale, isRtl, LOCALES } from "@/components/locales";
import { themeScript } from "@/components/preferences";
import { SITE } from "@/lib/seo";
import { getDictionary } from "./dictionaries";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Sirathic", template: "%s · Sirathic" },
  description: "Islamic answering engine.",
};

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
          {children}
          <CookieNotice />
        </I18nProvider>
      </body>
    </html>
  );
}
