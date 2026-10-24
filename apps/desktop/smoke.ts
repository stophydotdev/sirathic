import { z } from "zod";

const PORT = 9339;
const Targets = z.array(z.object({ type: z.string(), url: z.string() }));

const pageUrl = async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/list`).catch(() => undefined);
  if (!response?.ok) return undefined;
  const targets = Targets.parse(await response.json());
  return targets.find((target) => target.type === "page")?.url;
};

const waitForPage = async (
  matches: (url: string) => boolean,
  deadline: number,
): ReturnType<typeof pageUrl> => {
  const url = await pageUrl();
  if ((url && matches(url)) || Date.now() > deadline) return url;
  await Bun.sleep(500);
  return waitForPage(matches, deadline);
};

const expectPage = async (app: string, flags: string[], matches: (url: string) => boolean) => {
  const child = Bun.spawn([app, `--remote-debugging-port=${PORT}`, ...flags]);
  const url = await waitForPage(matches, Date.now() + 60_000);
  child.kill();
  await child.exited;
  if (!(url && matches(url))) throw new Error(`Unexpected page: ${url}`);
  console.log(`ok ${url}`);
};

const [app] = process.argv.slice(2);
if (!app) throw new Error("Usage: bun smoke.ts <path to the built app>");

await expectPage(app, [], (url) => url.startsWith("https://sirathic.com/"));
await expectPage(app, ["--proxy-server=http://127.0.0.1:9"], (url) =>
  url.includes("splash.html?retry="),
);
