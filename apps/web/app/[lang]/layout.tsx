import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/i18n";
import { hasLocale, isRtl, LOCALES } from "@/components/locales";
import { themeScript } from "@/components/preferences";
import { getDictionary } from "./dictionaries";
import "../globals.css";

export const metadata: Metadata = {
  title: "Sirathic",
  description: "Islamic answering engine.",
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const messages = await getDictionary(lang);

  return (
    <html
      lang={lang}
      dir={isRtl(lang) ? "rtl" : "ltr"}
      suppressHydrationWarning
      className="dark h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={lang} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
