import { expect, test } from "bun:test";
import { validateUIMessages } from "ai";
import { rehypeBareCitations } from "../apps/web/src/components/citations";
import { citationRuns, groupedCitations, withoutCitations } from "../apps/mobile/src/lib/sources";
import { citations, withBareCitations } from "../apps/server/src/chat/citations";
import { withoutPageText, withStoredPageText } from "../apps/server/src/chat/pageText";
import { cleanSearch } from "../apps/server/src/chat/searchQuery";
import {
  type ChatMessage,
  chatData,
  messageMetadata,
  sentMessage,
} from "../apps/server/src/shared/messages";
import { unwrappedCitations } from "../packages/app/src/citations";
import { hadithLink } from "../packages/core/src/tools/hadithLinks";

const streamed = async (transform: ReturnType<typeof citations>["transform"], deltas: string[]) => {
  const parts = new ReadableStream({
    start(controller) {
      for (const text of deltas) controller.enqueue({ type: "text-delta" as const, id: "1", text });
      controller.close();
    },
  }).pipeThrough(transform()({ tools: {}, stopStream: () => {} }));
  let text = "";
  for await (const part of parts) if (part.type === "text-delta") text += part.text;
  return text;
};

const linked = (urls: string[], deltas: string[]) => {
  const { add, transform } = citations([]);
  for (const url of urls) add(url);
  return streamed(transform, deltas);
};

const quran = (key: string) => `https://quran.com/${key.replace(":", "/")}`;

test("a citation whose link the model guessed keeps its number's real source", async () => {
  const urls = ["https://sunnah.com/bukhari:1", "https://sunnah.com/muslim:1907"];
  expect(await linked(urls, ["Intentions matter.[2](https://sunnah.com/made-up)"])).toBe(
    `Intentions matter.[2](${urls[1]})`,
  );
});

test("an earlier answer reaches the model with bare citation numbers", () => {
  const answer: ChatMessage = {
    id: "a",
    role: "assistant",
    parts: [{ type: "text", text: "Intentions matter.[1](https://sunnah.com/bukhari:1)" }],
  };
  const asked: ChatMessage = { id: "u", role: "user", parts: [{ type: "text", text: "[1](x)" }] };
  expect([answer, asked].map(withBareCitations).map((message) => message.parts)).toEqual([
    [{ type: "text", text: "Intentions matter.[1]" }],
    [{ type: "text", text: "[1](x)" }],
  ]);
});

test("a Quran citation moves to the retrieved verse its paragraph names", async () => {
  const cases = [
    {
      urls: [quran("2:219"), quran("5:90")],
      deltas: ["“…so avoid it that you may be successful.” (Qur’an 5:90)", "[1]"],
      expected: `“…so avoid it that you may be successful.” (Qur’an 5:90)[2](${quran("5:90")})`,
    },
    {
      urls: [quran("2:228"), quran("2:229")],
      deltas: ["“It is not lawful for you to take anything…” (Qur’an 2:229)[1]"],
      expected: `“It is not lawful for you to take anything…” (Qur’an 2:229)[2](${quran("2:229")})`,
    },
    {
      urls: [quran("24:47"), quran("3:100"), quran("34:31"), quran("49:14")],
      deltas: [
        "Earlier point.[3]\n\nQur’an 49:14 addresses Bedouins who said, “We have believed.” ",
        "It should not be generalized.[2]",
      ],
      expected: `Earlier point.[3](${quran("34:31")})\n\nQur’an 49:14 addresses Bedouins who said, “We have believed.” It should not be generalized.[4](${quran("49:14")})`,
    },
  ];
  expect(await Promise.all(cases.map(({ urls, deltas }) => linked(urls, deltas)))).toEqual(
    cases.map(({ expected }) => expected),
  );
});

test("a citation stays when it fits, or when the named verse wasn't retrieved", async () => {
  const urls = [quran("2:228"), quran("39:6"), "https://sunnah.com/bukhari:5590", quran("2:229")];
  const cases = [
    {
      text: "(Qur’an 2:228-229)[4]",
      expected: `(Qur’an 2:228-229)[4](${quran("2:229")})`,
    },
    { text: "(Qur’an 4:1)[2]", expected: `(Qur’an 4:1)[2](${quran("39:6")})` },
    {
      text: "Qur’an 2:228 and Bukhari 5590.[3]",
      expected: "Qur’an 2:228 and Bukhari 5590.[3](https://sunnah.com/bukhari:5590)",
    },
    {
      text: "Qur’an 39:6 says this.\n\nA new point.[1]",
      expected: `Qur’an 39:6 says this.\n\nA new point.[1](${quran("2:228")})`,
    },
  ];
  expect(await Promise.all(cases.map(({ text }) => linked(urls, [text])))).toEqual(
    cases.map(({ expected }) => expected),
  );
});

test("a citation after one that used the named verse keeps its own verse", async () => {
  const cases = [
    {
      urls: [quran("2:286"), quran("65:7")],
      text: "Allah says in 2:286 that no soul is burdened beyond its capacity [1]. At-Talaq says it too [2].",
      expected: `Allah says in 2:286 that no soul is burdened beyond its capacity [1](${quran("2:286")}). At-Talaq says it too [2](${quran("65:7")}).`,
    },
    {
      urls: [quran("2:183"), quran("2:185")],
      text: "Fasting was prescribed (2:183) [1], and the month is Ramadan [2].",
      expected: `Fasting was prescribed (2:183) [1](${quran("2:183")}), and the month is Ramadan [2](${quran("2:185")}).`,
    },
  ];
  expect(await Promise.all(cases.map(({ urls, text }) => linked(urls, [text])))).toEqual(
    cases.map(({ expected }) => expected),
  );
});

test("an image token split across chunks becomes that image, and an unknown one is dropped", async () => {
  const { addImage, transform } = citations([]);
  addImage({ url: "https://img.test/kaaba.jpg", title: "The [Kaaba] (2026)" });
  expect(await streamed(transform, ["The Kaaba:\n\n[ima", "ge:1]\n\n[image:9]\n"])).toBe(
    "The Kaaba:\n\n![The Kaaba 2026](https://img.test/kaaba.jpg)\n\n\n",
  );
});

test("an answer never shows an em dash, even one split across chunks", async () => {
  const { transform } = citations([]);
  const dash = String.fromCodePoint(0x2014);
  const deltas = ["Pray Fajr ", `${dash} even late ${dash}`, ` and rest.\n${dash} Ibn al-Qayyim`];
  expect(await streamed(transform, deltas)).toBe("Pray Fajr, even late, and rest.\nIbn al-Qayyim");
});

test("citations in parentheses lose the parentheses, and hiding them leaves no empty pair", () => {
  const wrapped =
    "Injections break it ([2](https://a.org/2)[3](https://b.org/3)). See ( [4](https://c.org/4) ).";
  expect(unwrappedCitations(wrapped)).toBe(
    "Injections break it [2](https://a.org/2)[3](https://b.org/3). See [4](https://c.org/4).",
  );
  expect(unwrappedCitations("Hanafis differ (see [1](https://a.org/1)).")).toBe(
    "Hanafis differ (see [1](https://a.org/1)).",
  );
  expect(withoutCitations(wrapped)).toBe("Injections break it. See.");
});

test("a phone citation pill keeps every source of its own run, even when runs share a first source", () => {
  const text =
    "Patience [1](https://quran.com/2/153) [2](https://islamqa.info/a). Prayer [3](https://quran.com/2/153) [4](https://sunnah.com/b). Gift [5](https://quran.com/2/153).";
  expect(groupedCitations(text)).toBe(
    "Patience [c0](https://quran.com/2/153). Prayer [c1](https://quran.com/2/153). Gift [c2](https://quran.com/2/153).",
  );
  expect(citationRuns(text)).toEqual([
    ["https://quran.com/2/153", "https://islamqa.info/a"],
    ["https://quran.com/2/153", "https://sunnah.com/b"],
    ["https://quran.com/2/153"],
  ]);
});

type Tree = Parameters<ReturnType<typeof rehypeBareCitations>>[0];

const sentence = (start: string): Tree => {
  const url = "https://example.com/a";
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [
          { type: "text", value: start },
          {
            type: "element",
            tagName: "a",
            properties: { href: url, dataUrls: [url] },
            children: [],
          },
          { type: "text", value: ". It is not shared by all." },
        ],
      },
    ],
  };
};

test("a hidden citation takes the space before it, so the period stays against the word", () => {
  const tree = sentence("That is the Hanafi view ");
  rehypeBareCitations()(tree);
  expect(tree).toEqual(sentence("That is the Hanafi view"));
});

test("a loaded chat drops search page text, and the next question gets it back", async () => {
  const output = {
    results: {
      fatwa: [
        {
          citation: 1,
          title: "Witr",
          site: "islamqa.org",
          date: null,
          text: "Witr is three rak'ahs.",
        },
      ],
    },
    sources: [{ url: "https://islamqa.org/1", title: "Witr", snippet: "Witr is" }],
    text: "[1] Witr is three rak'ahs.",
  };
  const stored: ChatMessage[] = [
    {
      id: "answer",
      role: "assistant",
      metadata: {},
      parts: [
        {
          type: "tool-search_web",
          toolCallId: "call",
          state: "output-available",
          input: { queries: ["witr"], sources: ["fatwa"] },
          output,
        },
      ],
    },
  ];
  const sent = withoutPageText(stored);
  expect(JSON.stringify(sent)).not.toContain("three rak'ahs");
  expect(sent[0]?.parts[0]).toMatchObject({ output: { sources: output.sources } });
  const sentBack = await validateUIMessages<ChatMessage>({
    messages: JSON.parse(JSON.stringify(sent)),
    dataSchemas: chatData,
    metadataSchema: messageMetadata,
  });
  expect(withStoredPageText(sentBack, stored)).toEqual(stored);
});

test("a saved chat sent back with the old tool names reaches the agent under the new ones", () => {
  const sent = sentMessage.parse({
    role: "assistant",
    parts: [
      { type: "tool-search", toolCallId: "c1", state: "input-available", input: {} },
      {
        type: "tool-webFetch",
        toolCallId: "c2",
        state: "output-available",
        input: { url: "https://islamqa.info/en/answers/1" },
        output: {
          url: "https://islamqa.info/en/answers/1",
          title: "Wudu",
          markdown: "Text",
          citation: 1,
          sources: [{ url: "https://islamqa.info/en/answers/1", title: "Wudu", snippet: "" }],
        },
      },
      { type: "tool-quranGet", toolCallId: "c3", state: "input-available", input: {} },
    ],
  });
  expect(sent.parts).toEqual([
    { type: "tool-search_web", toolCallId: "c1", state: "input-available", input: {} },
    {
      type: "tool-fetch_url",
      toolCallId: "c2",
      state: "output-available",
      input: { urls: ["https://islamqa.info/en/answers/1"] },
      output: {
        pages: [
          {
            url: "https://islamqa.info/en/answers/1",
            title: "Wudu",
            markdown: "Text",
            citation: 1,
          },
        ],
        sources: [{ url: "https://islamqa.info/en/answers/1", title: "Wudu", snippet: "" }],
      },
    },
    { type: "tool-get_verses", toolCallId: "c3", state: "input-available", input: {} },
  ]);
});

test("hadith links follow each collection's own page numbering", () => {
  expect([
    hadithLink("malik:1074", null),
    hadithLink("muslim:1907a", null),
    hadithLink("bukhari:402.2", null),
    hadithLink("ahmad:781", "https://ar.wikisource.org/wiki/chapter"),
  ]).toEqual([
    "https://sunnah.com/urn/510770",
    "https://sunnah.com/muslim:1907a",
    "https://sunnah.com/bukhari:402",
    "https://ar.wikisource.org/wiki/chapter#781",
  ]);
});

test("site: moves into sites, quotes and uppercase operators go, Arabic stays as written", () => {
  expect(
    cleanSearch({
      queries: ['"zakat on jewelry" site:islamqa.info', "zakat OR sadaqah  NOT  gold or silver"],
      arabic: ["«زكاة الحلي» AND الذهب"],
      sites: ["https://www.Islamweb.net/ar/"],
    }),
  ).toEqual({
    queries: ["zakat on jewelry", "zakat sadaqah gold or silver"],
    arabic: ["زكاة الحلي الذهب"],
    sites: ["islamweb.net", "islamqa.info"],
    notes: [],
  });
});
