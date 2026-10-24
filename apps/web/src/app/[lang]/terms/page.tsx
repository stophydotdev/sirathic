import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT, LegalPage } from "@/components/legal-page";
import { translator } from "../dictionaries";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Sirathic.",
};

export default async function TermsPage({
  params,
}: PageProps<"/[lang]/terms">) {
  const { locale, t } = await translator((await params).lang);
  return (
    <LegalPage
      home={`/${locale}`}
      back={t("Back to Sirathic")}
      title="Terms of service"
      updated="October 20, 2026"
    >
      <p>
        These terms cover your use of Sirathic, the free Islamic answering
        engine at sirathic.com and in the Sirathic apps. By using Sirathic you
        agree to them.
      </p>

      <h2>Answers are not fatwas</h2>
      <p>
        Sirathic answers with AI, from the Quran, hadith, fatwas, fiqh books and
        the web, and it cites what it used. AI can be wrong, quote a source out
        of context, or miss a view. Check the sources it cites. For a ruling
        about your own situation, ask a qualified scholar you trust.
      </p>

      <h2>Your account</h2>
      <p>
        You can sign in with Google or with ChatGPT. Keep your account to
        yourself, and tell us if someone else uses it. GPT answers run on your
        own ChatGPT plan, so OpenAI's terms apply to them too. You must be at
        least 13 to use Sirathic.
      </p>

      <h2>Fair use</h2>
      <p>
        Sirathic is free, so some answers have a daily limit, such as 30 Noor
        answers a day. Please don't:
      </p>
      <ul>
        <li>break the law or use Sirathic to harm anyone</li>
        <li>scrape it, flood it with requests, or get around its limits</li>
        <li>try to break into it or into other people's accounts</li>
      </ul>
      <p>We may suspend an account that does.</p>

      <h2>Your questions and the sources</h2>
      <p>
        Your questions and chats are yours. You let us process them to answer
        you, as the <Link href={`/${locale}/privacy`}>privacy policy</Link>{" "}
        explains. The Quran translations, hadith, fatwas and books Sirathic
        quotes belong to their authors and publishers, and Sirathic shows them
        for non-commercial use with credit.
      </p>

      <h2>No warranty</h2>
      <p>
        Sirathic is provided as is. We work to keep it accurate and running, but
        we can't promise it will always be correct or available, and we may
        change or stop any part of it. As far as the law allows, we aren't
        liable for losses from using it.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using Sirathic at any time and ask us to delete your
        account. We may end the service, and we'll say so on the site first.
      </p>

      <h2>Changes</h2>
      <p>
        If we change these terms, we'll update the date at the top. Using
        Sirathic after that means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </LegalPage>
  );
}
