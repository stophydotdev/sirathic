import { expect, test } from "bun:test";
import { citations, withBareCitations } from "../apps/server/src/chat/citations";
import {
  bestPieces,
  hadithBlock,
  pageText,
  quranBlock,
  unvowel,
} from "../apps/server/src/chat/compact";
import { convertToModelMessages } from "ai";
import { type ChatMessage, sentMessage } from "../apps/server/src/shared/messages";
import { shortenEarlierResults } from "../apps/server/src/chat/history";
import { keepAlive } from "../apps/server/src/chat/keepAlive";
import { clientOf } from "../apps/server/src/chat/client";
import { codeTools } from "../apps/server/src/chat/codeTools";
import { toolFailure } from "../apps/server/src/chat/events";
import { recentTurns } from "../apps/server/src/bots/tools";
import { findInChat } from "../apps/server/src/bots/chatSearch";
import { hadithIdOfSunnahUrl } from "../packages/core/src/tools/hadithLinks";

const linked = async (urls: string[], deltas: string[]) => {
  const { add, transform } = citations([]);
  for (const url of urls) add(url);
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

test("unvowel drops vowel marks but keeps letters, hamzas and digits", () => {
  expect(unvowel("إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ ٣")).toBe("إنما الأعمال بالنيات ٣");
});

test("a verse reaches the model as its translation, and hadith Arabic is unvowelled", () => {
  const verse = {
    citation: 1,
    arabic: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
    english: "For indeed, with hardship will be ease.",
    tafsir: null,
  };
  const verses = quranBlock([
    { ...verse, ref: "Quran 94:5 (Ash-Sharh)" },
    { ...verse, citation: 2, ref: "Quran 94:6 (Ash-Sharh)" },
  ]);
  expect(verses).toBe(
    "## quran\n[1] Quran 94:5 (Ash-Sharh)\nFor indeed, with hardship will be ease.\n[2] Quran 94:6 (Ash-Sharh)\nFor indeed, with hardship will be ease.",
  );

  const hadith = hadithBlock([
    {
      citation: 3,
      ref: "Sahih al-Bukhari 1",
      english: null,
      arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ",
      grade: "Sahih",
    },
  ]);
  expect(hadith).toBe("## hadith\n[3] Sahih al-Bukhari 1 (Sahih)\nإنما الأعمال بالنيات");
});

test("a long hadith reaches the model whole, with the collector's verdict", () => {
  const narration = "حدثنا قتيبة حدثنا الليث عن ابن شهاب ".repeat(8);
  const block = hadithBlock([
    {
      citation: 4,
      ref: "Jami' at-Tirmidhi 2107",
      english: null,
      arabic: `${narration}قال أبو عيسى هذا حديث حسن صحيح`,
      grade: null,
    },
  ]);
  expect(block).toContain(`${narration}قال أبو عيسى هذا حديث حسن صحيح`);
});

test("a page keeps its text with links reduced to their words, up to the limit", () => {
  const page =
    "# Combining prayers\n\n\n\nThe [Hanafi school](https://example.com/hanafi) allows it only at Arafah. ![map](https://example.com/map.png)";
  expect(pageText(page, 1000)).toBe(
    "# Combining prayers\n\nThe Hanafi school allows it only at Arafah.",
  );
  expect(pageText(page, 18)).toBe("# Combining prayer…");
});

test("a page loses its menus, buttons, footnote links and repeated captions", () => {
  const page = [
    "×",
    "  - [Zakat](https://example.com/zakat)",
    "[![Quiz](https://example.com/q.jpg)](https://example.com/quiz)",
    "Share",
    "A fresco of the battle.",
    "Badr was fought in 624.[\\[1\\]](https://en.wikipedia.org/wiki/Badr#cite_note-1)",
    '| Location | [Badr](https://en.wikipedia.org/wiki/Badr_(city) "Badr (city)") |',
    "A fresco of the battle.",
  ].join("\n");
  expect(pageText(page, 1000)).toBe(
    "A fresco of the battle.\nBadr was fought in 624.\n| Location | Badr |",
  );
});

test("a long text keeps the pieces that carry the query words, in page order", () => {
  const filler = "Prayer times are fixed for every Muslim. ".repeat(12);
  const ruling = "The traveller may combine Dhuhr and Asr in the time of either one.";
  const text = `${filler}\n${ruling}\nAnd Allah knows best.`;
  expect(bestPieces("Short text.", ["combine"], 100)).toBe("Short text.");
  const kept = bestPieces(text, ["combine dhuhr asr"], 300);
  expect(kept).toContain(ruling);
  expect(kept.length).toBeLessThanOrEqual(301);
  expect(bestPieces(text, ["zakat"], 50)).toBe(`${text.slice(0, 50)}…`);
});

const searched = (toolCallId: string): ChatMessage["parts"][number] => ({
  type: "tool-search_web",
  toolCallId,
  state: "output-available",
  input: { queries: ["what breaks wudu"], sources: ["fatwa"] },
  output: {
    results: {},
    sources: [
      {
        url: "https://islamqa.info/en/answers/14321",
        title: "Wudu",
        snippet: "",
      },
      { url: "https://example.com/uncited", title: "Uncited", snippet: "" },
    ],
    text: "",
  },
});

const history: ChatMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "what breaks wudu" }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      searched("call-1"),
      {
        type: "text",
        text: "Deep sleep breaks wudu.[4](https://islamqa.info/en/answers/14321)",
      },
    ],
  },
  { id: "u2", role: "user", parts: [{ type: "text", text: "and bleeding?" }] },
  { id: "a2", role: "assistant", parts: [searched("call-2")] },
];

const sentOutputs = async (toolCallId: string, chat = history) => {
  const shorten = shortenEarlierResults(chat);
  return (await convertToModelMessages(chat))
    .map(shorten)
    .flatMap((message) => (message.role === "tool" ? message.content : []))
    .flatMap((part) =>
      part.type === "tool-result" && part.toolCallId === toolCallId ? [part.output] : [],
    );
};

test("an earlier turn's results reach the model as the sources its answer cited", async () => {
  expect(await sentOutputs("call-1")).toEqual([
    {
      type: "text",
      value:
        "Earlier results, removed to save space. Cited in the answer: [4] Wudu. Search again if you need their full text.",
    },
  ]);
});

test("an earlier turn's results read the same after a later answer cites one of them", async () => {
  const later: ChatMessage[] = [
    ...history.slice(0, 3),
    {
      id: "a2",
      role: "assistant",
      parts: [{ type: "text", text: "Also bleeding.[5](https://example.com/uncited)" }],
    },
    { id: "u3", role: "user", parts: [{ type: "text", text: "and sleep?" }] },
  ];
  expect(await sentOutputs("call-1", later)).toEqual(await sentOutputs("call-1"));
});

test("results after the last question reach the model in full", async () => {
  expect((await sentOutputs("call-2"))[0]).toEqual({
    type: "json",
    value: {
      results: {},
      sources: [
        {
          url: "https://islamqa.info/en/answers/14321",
          title: "Wudu",
          snippet: "",
        },
        { url: "https://example.com/uncited", title: "Uncited", snippet: "" },
      ],
      text: "",
    },
  });
});

test("keepAlive pings while the stream is quiet and passes the data through", async () => {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const source = writable.getWriter();
  const piped = readable.pipeThrough(keepAlive(20));
  const reader = piped.getReader();

  expect(new TextDecoder().decode((await reader.read()).value)).toBe(": ping\n\n");

  reader.releaseLock();
  await source.write(new TextEncoder().encode("data: {}\n\n"));
  await source.close();
  const rest = await Array.fromAsync(piped);
  expect(new TextDecoder().decode(rest.at(-1))).toBe("data: {}\n\n");
});

const clientFor = (userAgent: string, country = "") =>
  clientOf(new Headers({ "user-agent": userAgent, "x-sirathic-country": country }));

test("the operating system and browser come from the user agent", () => {
  const families = [
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1",
      "iOS",
      "Safari",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15",
      "macOS",
      "Safari",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1",
      "iOS",
      "Chrome",
    ],
    [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
      "Android",
      "Samsung",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Windows",
      "Edge",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0", "Linux", "Firefox"],
    ["curl/8.16.0", "other", "other"],
  ];
  expect(
    families.map(([userAgent = ""]) => {
      const { os, browser } = clientFor(userAgent);
      return [userAgent, os, browser];
    }),
  ).toEqual(families);
});

test("the country is kept only as a two-letter code", () => {
  expect(
    ["SI", "si", "Slovenia", ""].map((country) => clientFor("curl/8.16.0", country).country),
  ).toEqual(["SI", undefined, undefined, undefined]);
});

test("a sunnah.com hadith link maps to our hadith id, and a failed tool gets a kind", () => {
  expect(hadithIdOfSunnahUrl("https://sunnah.com/bukhari:7191")).toBe("bukhari:7191");
  expect(hadithIdOfSunnahUrl("https://sunnah.com/nawawi40:3")).toBe("nawawi:3");
  expect(hadithIdOfSunnahUrl("https://sunnah.com/bukhari/93")).toBeNull();
  expect(toolFailure("sunnah.com pages can't be read. Search for the hadith instead.")).toBe(
    "blocked",
  );
  expect(toolFailure("Fetching https://a.b found no readable text")).toBe("no-text");
  expect(toolFailure("Fetching https://a.b failed: That site has no page at that address.")).toBe(
    "not-found",
  );
});

const turn = (i: number) => [
  { role: "user", id: `q${i}` },
  { role: "assistant", id: `a${i}` },
];

test("a long bot chat sends its recent turns, starting at a question", () => {
  const chat = Array.from({ length: 20 }, (_, i) => turn(i)).flat();
  const recent = recentTurns(chat, 5);
  expect(recent.map((message) => message.id)).toEqual(["q18", "a18", "q19", "a19"]);
  expect(recentTurns(chat.slice(0, 3), 24)).toHaveLength(3);
});

const said = (id: string, role: ChatMessage["role"], text: string, createdAt?: number) =>
  ({ id, role, parts: [{ type: "text", text }], metadata: { createdAt } }) satisfies ChatMessage;

test("chat search finds earlier messages with dates, best match first, and skips the question", () => {
  const chat = [
    said("1", "user", "Teach me a hadith about intentions", Date.UTC(2026, 9, 12)),
    said(
      "2",
      "assistant",
      "Today's hadith: actions are judged by intentions.",
      Date.UTC(2026, 9, 12),
    ),
    said("3", "user", "What about patience?", Date.UTC(2026, 9, 13)),
    said(
      "4",
      "assistant",
      "Patience is half of faith, and a hadith praises it.",
      Date.UTC(2026, 9, 13),
    ),
    said("5", "user", "which hadith about intentions did you teach me"),
  ];
  const found = findInChat(chat, "hadith intentions");
  expect(found.map((match) => match.from)).toEqual(["you", "user", "you"]);
  expect(found[0]).toEqual({
    from: "you",
    date: "2026-10-12",
    snippet: "Today's hadith: actions are judged by intentions.",
  });
  expect(findInChat(chat, "zakat")).toEqual([]);
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
      { type: "tool-duaSearch", toolCallId: "c4", state: "input-available", input: {} },
      { type: "tool-setBotJob", toolCallId: "c5", state: "input-available", input: {} },
      { type: "text", text: "Done." },
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
    { type: "tool-search_duas", toolCallId: "c4", state: "input-available", input: {} },
    { type: "tool-set_bot_job", toolCallId: "c5", state: "input-available", input: {} },
    { type: "text", text: "Done." },
  ]);
});

test("the code sandbox is offered to Noor and to no other model", () => {
  expect(Object.keys(codeTools("sirathic-noor-1-flash"))).toEqual(["code_execution"]);
  expect(Object.keys(codeTools("gpt-6-luna"))).toEqual([]);
});
