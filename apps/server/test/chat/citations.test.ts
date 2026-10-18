import { expect, test } from "bun:test";
import { citations } from "../../src/chat/citations";

const linked = async (urls: string[], deltas: string[]) => {
  const { add, transform } = citations([]);
  for (const url of urls) add(url);
  const parts = new ReadableStream({
    start(controller) {
      for (const text of deltas)
        controller.enqueue({ type: "text-delta" as const, id: "1", text });
      controller.close();
    },
  }).pipeThrough(transform()({ tools: {}, stopStream: () => {} }));
  let text = "";
  for await (const part of parts)
    if (part.type === "text-delta") text += part.text;
  return text;
};

const quran = (key: string) => `https://quran.com/${key.replace(":", "/")}`;

test("a Quran citation moves to the retrieved verse its paragraph names", async () => {
  const cases = [
    {
      urls: [quran("2:219"), quran("5:90")],
      deltas: [
        "“…so avoid it that you may be successful.” (Qur’an 5:90)",
        "[1]",
      ],
      expected: `“…so avoid it that you may be successful.” (Qur’an 5:90)[2](${quran("5:90")})`,
    },
    {
      urls: [quran("2:228"), quran("2:229")],
      deltas: [
        "“It is not lawful for you to take anything…” (Qur’an 2:229)[1]",
      ],
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
  expect(
    await Promise.all(cases.map(({ urls, deltas }) => linked(urls, deltas))),
  ).toEqual(cases.map(({ expected }) => expected));
});

test("a citation stays when it fits, or when the named verse wasn't retrieved", async () => {
  const urls = [
    quran("2:228"),
    quran("39:6"),
    "https://sunnah.com/bukhari:5590",
    quran("2:229"),
  ];
  const cases = [
    {
      text: "(Qur’an 2:228-229)[4]",
      expected: `(Qur’an 2:228-229)[4](${quran("2:229")})`,
    },
    { text: "(Qur’an 4:1)[2]", expected: `(Qur’an 4:1)[2](${quran("39:6")})` },
    {
      text: "Qur’an 2:228 and Bukhari 5590.[3]",
      expected:
        "Qur’an 2:228 and Bukhari 5590.[3](https://sunnah.com/bukhari:5590)",
    },
    {
      text: "Qur’an 39:6 says this.\n\nA new point.[1]",
      expected: `Qur’an 39:6 says this.\n\nA new point.[1](${quran("2:228")})`,
    },
  ];
  expect(
    await Promise.all(cases.map(({ text }) => linked(urls, [text]))),
  ).toEqual(cases.map(({ expected }) => expected));
});
