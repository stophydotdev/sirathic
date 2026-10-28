import type { Metadata } from "next";
import { NewChat } from "@/components/newChat";
import { alternatesOf, SITE } from "@/lib/seo";

export const metadata: Metadata = { alternates: alternatesOf("") };

const PROFILES = [
  "https://x.com/sirathic",
  "https://www.instagram.com/sirathic",
  "https://www.tiktok.com/@sirathic",
  "https://www.facebook.com/sirathic",
];

const STRUCTURED_DATA = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "Sirathic",
      url: SITE,
      logo: `${SITE}/icon.svg`,
      sameAs: PROFILES,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: "Sirathic",
      url: SITE,
      publisher: { "@id": `${SITE}/#organization` },
    },
  ],
});

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }} />
      <NewChat />
    </>
  );
}
