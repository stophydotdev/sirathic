import { expect, test } from "bun:test";
import { clientOf } from "../src/client";

const clientFor = (userAgent: string, country = "") =>
  clientOf(
    new Headers({ "user-agent": userAgent, "x-sirathic-country": country }),
  );

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
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      "Linux",
      "Firefox",
    ],
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
    ["SI", "si", "Slovenia", ""].map(
      (country) => clientFor("curl/8.16.0", country).country,
    ),
  ).toEqual(["SI", undefined, undefined, undefined]);
});
