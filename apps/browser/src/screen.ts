import { existsSync, rmSync } from "node:fs";
import type { Subprocess } from "bun";

export const SCREEN = { width: 1280, height: 800 };

const FIRST_DISPLAY = 100;
const VNC_BASE_PORT = 5800;
const READY_MS = 5_000;
const POLL_MS = 50;

export type Screen = {
  display: number;
  port: number;
  env: Record<string, string>;
  processes: Subprocess[];
};

const used = new Set<number>();

const until = async (
  ready: () => boolean | Promise<boolean>,
  what: string,
  deadline = Date.now() + READY_MS,
): Promise<void> => {
  if (await ready()) return;
  if (Date.now() > deadline) throw new Error(`${what} did not start`);
  await Bun.sleep(POLL_MS);
  return until(ready, what, deadline);
};

const listening = (port: number) =>
  Bun.connect({ hostname: "127.0.0.1", port, socket: { data: () => undefined } }).then(
    (socket) => {
      socket.end();
      return true;
    },
    () => false,
  );

export const closeScreen = (screen: Screen) => {
  for (const process of screen.processes) process.kill();
  used.delete(screen.display);
};

export const openScreen = async (): Promise<Screen> => {
  let display = FIRST_DISPLAY;
  while (used.has(display)) display += 1;
  used.add(display);
  const port = VNC_BASE_PORT + display;
  rmSync(`/tmp/.X${display}-lock`, { force: true });
  rmSync(`/tmp/.X11-unix/X${display}`, { force: true });
  const screen: Screen = {
    display,
    port,
    env: { DISPLAY: `:${display}`, HOME: "/tmp", PATH: "/usr/bin:/bin", LANG: "en_US.UTF-8" },
    processes: [],
  };
  try {
    screen.processes.push(
      Bun.spawn(
        [
          "Xvfb",
          `:${display}`,
          "-screen",
          "0",
          `${SCREEN.width}x${SCREEN.height}x24`,
          "-nolisten",
          "tcp",
        ],
        { stdout: "ignore", stderr: "ignore" },
      ),
    );
    await until(() => existsSync(`/tmp/.X11-unix/X${display}`), "the screen");
    screen.processes.push(
      Bun.spawn(
        [
          "x11vnc",
          "-display",
          `:${display}`,
          "-rfbport",
          String(port),
          "-localhost",
          "-shared",
          "-forever",
          "-nopw",
          "-quiet",
          "-xkb",
          "-noxdamage",
          "-cursor",
          "arrow",
          "-nobell",
        ],
        { stdout: "ignore", stderr: "ignore", env: screen.env },
      ),
    );
    await until(() => listening(port), "the screen stream");
    return screen;
  } catch (error) {
    closeScreen(screen);
    throw error;
  }
};
