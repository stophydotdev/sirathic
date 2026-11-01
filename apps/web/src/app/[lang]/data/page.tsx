import type { Metadata } from "next";
import { LegalPage } from "@/components/legalPage";
import { alternatesOf } from "@/lib/seo";
import { translator } from "../dictionaries";

export const metadata: Metadata = {
  title: "Open data",
  description:
    "Free Quran and hadith data with no API key: verses, translations, hadith checked against sunnah.com, and full downloads.",
  alternates: alternatesOf("/data"),
};

const API = "https://api.sirathic.com/v1";

const QURAN = [
  { path: "/quran/surahs", about: "The 114 surahs.", open: true },
  { path: "/quran/surahs/{surah}", about: "One surah, every verse in Uthmani and simple script." },
  { path: "/quran/verses/{surah}:{ayah}", about: "One verse. Add ?translations=key1,key2." },
  { path: "/quran/verses?juz={1-30}", about: "Every verse in one juz." },
  { path: "/quran/translations", about: "The translations and their keys.", open: true },
  { path: "/quran/translations/{key}/{surah}", about: "One translation of one surah." },
];

const HADITH = [
  { path: "/hadith/collections", about: "The collections, with verified counts.", open: true },
  {
    path: "/hadith/{collection}/{number}",
    about: "One hadith with its grades, and whether it is verified.",
  },
  { path: "/hadith/resolve?ref={reference}", about: "A written reference, turned into a hadith." },
  {
    path: "/hadith/curated/{id}?lang={code}",
    about: "A graded, explained hadith from HadeethEnc.",
  },
  { path: "/hadith/curated/categories", about: "The HadeethEnc categories.", open: true },
  { path: "/hadith/unverified", about: "Every hadith we could not match, and why.", open: true },
];

const Endpoints = ({ list }: { list: typeof QURAN }) => (
  <ul>
    {list.map(({ path, about, open }) => (
      <li key={path}>
        {open ? (
          <a href={`${API}${path}`}>
            <code className="text-sm break-all">/v1{path}</code>
          </a>
        ) : (
          <code className="text-foreground text-sm break-all">/v1{path}</code>
        )}{" "}
        {about}
      </li>
    ))}
  </ul>
);

export default async function DataPage({ params }: PageProps<"/[lang]/data">) {
  const { t } = await translator((await params).lang);
  return (
    <LegalPage home="/" back={t("Back to Sirathic")} title="Open data" updated="November 1, 2026">
      <p>
        Quran and hadith data you can build on. It is free, with no API key. Every response names
        its source, its license and its version. A hadith marked verified has the same Arabic and
        the same number as sunnah.com.
      </p>
      <p>
        It holds 6,236 verses, 76 translations in 56 languages, 36,512 hadith from 10 collections
        (33,413 of them verified), and 153 files to download.
      </p>

      <h2>Try it</h2>
      <pre className="bg-muted mt-4 overflow-x-auto rounded-lg p-4 text-sm leading-6">
        <code>{`curl "${API}/quran/verses/2:255?translations=french_rashid"`}</code>
      </pre>
      <p>
        You get Ayat al-Kursi in Uthmani and simple script, its juz, page and hizb, and Rachid
        Maach&apos;s French translation with its title and version. The index at{" "}
        <a href={API}>api.sirathic.com/v1</a> lists every endpoint.
      </p>

      <h2>Quran</h2>
      <Endpoints list={QURAN} />

      <h2>Hadith</h2>
      <Endpoints list={HADITH} />

      <h2>Files and licenses</h2>
      <p>
        <a href={`${API}/downloads`}>/v1/downloads</a> lists whole datasets as SQLite and JSON, each
        with its size and sha256, and <code className="text-sm">/v1/downloads/{"{name}"}</code>{" "}
        fetches one. Each source keeps its own terms, listed at{" "}
        <a href={`${API}/sources`}>/v1/sources</a>. QuranEnc translations are republished unchanged
        and credit QuranEnc.com, and the Tanzil Quran text is CC BY 3.0.
      </p>
    </LegalPage>
  );
}
