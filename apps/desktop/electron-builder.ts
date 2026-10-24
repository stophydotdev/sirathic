import type { Configuration } from "electron-builder";

export default {
  appId: "com.sirathic.desktop",
  files: ["main.ts", "splash.html"],
  beforeBuild: async () => false,
  mac: {
    target: { target: "dmg", arch: ["arm64", "x64"] },
    category: "public.app-category.reference",
    artifactName: "Sirathic-mac-${arch}.${ext}",
  },
  win: {
    target: { target: "nsis", arch: ["x64", "arm64"] },
    artifactName: "Sirathic-windows.${ext}",
  },
  linux: {
    target: [
      { target: "AppImage", arch: ["x64", "arm64"] },
      { target: "deb", arch: ["x64", "arm64"] },
      { target: "rpm", arch: ["x64", "arm64"] },
      { target: "pacman", arch: ["x64", "arm64"] },
    ],
    category: "Education",
    executableName: "sirathic",
    maintainer: "Hussein Hakizimana <189969103+hakiiizimana@users.noreply.github.com>",
    artifactName: "Sirathic-linux-${arch}.${ext}",
  },
  deb: { packageName: "sirathic" },
  rpm: { packageName: "sirathic" },
  pacman: {
    packageName: "sirathic",
    depends: ["gtk3", "nss", "alsa-lib", "mesa", "xdg-utils"],
    compression: "zstd",
    artifactName: "Sirathic-linux-${arch}.pkg.tar.zst",
  },
} satisfies Configuration;
