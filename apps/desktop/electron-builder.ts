import type { Configuration } from "electron-builder";

export default {
  appId: "com.sirathic.desktop",
  files: ["main.ts", "splash.html"],
  beforeBuild: async () => false,
  mac: {
    target: { target: "dmg", arch: ["arm64", "x64"] },
    category: "public.app-category.reference",
  },
  win: { target: { target: "nsis", arch: ["x64", "arm64"] } },
  linux: {
    target: { target: "AppImage", arch: ["x64", "arm64"] },
    category: "Education",
  },
} satisfies Configuration;
