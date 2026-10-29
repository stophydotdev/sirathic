import type { CDPSession, Page } from "patchright";
import { VIEWPORT, type ViewEvent } from "./protocol";
import { existing } from "./sessions";

const TICK_MS = 1_000;
const TICK_LIMIT_MS = 5_000;
const PING_MS = 15_000;
const FRAME_QUALITY = 60;

type Watching = { page: Page; cdp: CDPSession };

export const view = (key: string, hungUp: AbortSignal) => {
  const encoder = new TextEncoder();
  let watching: Watching | undefined;
  let shown = "";
  let busy = false;
  const stop = async () => {
    const was = watching;
    watching = undefined;
    if (!was) return;
    await was.cdp.send("Page.stopScreencast").catch(() => undefined);
    await was.cdp.detach().catch(() => undefined);
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => {
        if (!hungUp.aborted) controller.enqueue(encoder.encode(text));
      };
      const send = (event: ViewEvent) => write(`data: ${JSON.stringify(event)}\n\n`);
      const watch = async (page: Page) => {
        const cdp = await page.context().newCDPSession(page);
        cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
          send({ kind: "frame", jpeg: data });
          void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
        });
        await cdp.send("Page.startScreencast", {
          format: "jpeg",
          quality: FRAME_QUALITY,
          maxWidth: VIEWPORT.width,
          maxHeight: VIEWPORT.height,
        });
        watching = { page, cdp };
      };
      const tick = async () => {
        const session = await existing(key);
        if (!session) {
          await stop();
          if (shown !== "closed") send({ kind: "closed" });
          shown = "closed";
          return;
        }
        session.lastUsed = Date.now();
        const url = session.page.url();
        const title = await session.page.title().catch(() => "");
        if (shown !== `${url} ${title}`) send({ kind: "page", url, title });
        shown = `${url} ${title}`;
        if (watching?.page !== session.page) {
          await stop();
          await watch(session.page);
        }
      };
      const tickOnce = () => {
        if (busy) return;
        busy = true;
        void Promise.race([
          tick(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("the live view stalled")), TICK_LIMIT_MS);
          }),
        ])
          .catch((error: Error) => {
            console.error(JSON.stringify({ view: key, error: error.message.slice(0, 300) }));
            return stop();
          })
          .finally(() => {
            busy = false;
          });
      };
      const ticks = setInterval(tickOnce, TICK_MS);
      const pings = setInterval(() => write(": ping\n\n"), PING_MS);
      tickOnce();
      hungUp.addEventListener(
        "abort",
        () => {
          clearInterval(ticks);
          clearInterval(pings);
          void stop();
          controller.close();
        },
        { once: true },
      );
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
};
