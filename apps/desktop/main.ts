import { join } from "node:path";
import { app, BrowserWindow, nativeTheme, shell } from "electron";

const SITE = new URL("https://sirathic.com");
const SPLASH = join(import.meta.dirname, "splash.html");
const ERR_ABORTED = -3;
const ERR_NETWORK_CHANGED = -21;

const openInBrowser = (url: string) => {
  const parsed = URL.parse(url);
  if (parsed?.protocol === "https:" || parsed?.protocol === "http:")
    void shell.openExternal(parsed.href);
};

const openWindow = () => {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#161616" : "#ffffff",
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (URL.parse(url)?.origin === SITE.origin) return;
    event.preventDefault();
    openInBrowser(url);
  });
  window.webContents.on("did-fail-load", (_event, code, _description, url, isMainFrame) => {
    if (!isMainFrame || code === ERR_ABORTED) return;
    if (code === ERR_NETWORK_CHANGED) void window.loadURL(url);
    else void window.loadFile(SPLASH, { query: { retry: url } });
  });
  void window.loadFile(SPLASH).then(() => {
    void window.loadURL(SITE.href);
  });
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

void app.whenReady().then(() => {
  openWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});
