const OS_FAMILIES = [
  ["iOS", /iPhone|iPad|iPod/u],
  ["Android", /Android/u],
  ["Windows", /Windows/u],
  ["macOS", /Macintosh|Mac OS X/u],
  ["ChromeOS", /CrOS/u],
  ["Linux", /Linux/u],
] as const;

const BROWSER_FAMILIES = [
  ["Edge", /Edg\//u],
  ["Opera", /OPR\//u],
  ["Samsung", /SamsungBrowser/u],
  ["Firefox", /Firefox|FxiOS/u],
  ["Chrome", /Chrome\/|CriOS/u],
  ["Safari", /Safari\//u],
] as const;

const familyOf = <Name extends string>(
  families: readonly (readonly [Name, RegExp])[],
  userAgent: string,
) => families.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? "other";

export const clientOf = (headers: Headers) => {
  const userAgent = headers.get("user-agent") ?? "";
  const country = headers.get("x-sirathic-country") ?? "";
  return {
    os: familyOf(OS_FAMILIES, userAgent),
    browser: familyOf(BROWSER_FAMILIES, userAgent),
    country: /^[A-Z]{2}$/u.test(country) ? country : undefined,
  };
};

export type Client = ReturnType<typeof clientOf>;
