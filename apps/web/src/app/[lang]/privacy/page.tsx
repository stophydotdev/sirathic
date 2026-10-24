import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT, LegalPage } from "@/components/legal-page";
import { translator } from "../dictionaries";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Sirathic keeps, who else sees your questions, and your choices.",
};

export default async function PrivacyPage({
  params,
}: PageProps<"/[lang]/privacy">) {
  const { locale, t } = await translator((await params).lang);
  return (
    <LegalPage
      home={`/${locale}`}
      back={t("Back to Sirathic")}
      title="Privacy policy"
      updated="October 20, 2026"
    >
      <p>
        Sirathic is a free Islamic answering engine at sirathic.com and in the
        Sirathic apps. It has no ads, and we don't sell your data or use outside
        trackers.
      </p>

      <h2>What we keep</h2>
      <p>
        Without signing in, you can read the Quran and hadith. We don't store
        anything that names you.
      </p>
      <p>When you sign in, we keep:</p>
      <ul>
        <li>
          Your account. With Google, that's your name, email address and profile
          picture. With ChatGPT, it's your ChatGPT account ID and plan. We store
          the sign-in tokens these services give us, encrypted.
        </li>
        <li>
          Your sign-ins. For each device, we keep the IP address and browser it
          signed in from. A sign-in lasts 30 days.
        </li>
        <li>
          Your chats, meaning your questions, the answers and their sources, so
          you can open them again. Chats in incognito aren't saved.
        </li>
        <li>Your settings, and any thumbs up or down you give an answer.</li>
        <li>
          Usage records. These list the mode and model you used, how long the
          answer took, how many sources it cited, and your device type,
          operating system, browser and country. They never include the text of
          a question or an answer.
        </li>
      </ul>
      <p>We don't train AI models on your chats.</p>

      <h2>Who else sees your questions</h2>
      <p>
        To answer you, we send your question and the passages we found to the
        model you picked: Anthropic for Noor, OpenAI for GPT models under your
        own ChatGPT plan, or Google for Gemini. We also send search text to
        OpenAI to search our library, and to Stophy to search the web.
      </p>
      <p>
        Our database runs on Neon, our servers on Railway, and the website on
        Cloudflare. They store or carry your data only to run Sirathic.
      </p>

      <h2>Cookies</h2>
      <p>
        We use cookies only to sign you in and keep you signed in. Your browser
        also keeps your settings and your chat list on your device, so the site
        loads fast. We use no advertising or analytics cookies.
      </p>

      <h2 id="choices">Your choices</h2>
      <ul>
        <li>Turn on incognito, and new chats aren't saved.</li>
        <li>Delete one chat from its menu, or all of them in Settings.</li>
        <li>Export all your chats in Settings.</li>
        <li>
          Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> to delete your
          account. We delete your account, chats, settings and usage records
          within 30 days.
        </li>
      </ul>

      <h2>Children</h2>
      <p>Sirathic is not for children under 13.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we'll update the date at the top.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also our{" "}
        <Link href={`/${locale}/terms`}>terms of service</Link>.
      </p>
    </LegalPage>
  );
}
