import type { Metadata } from "next";
import { headers } from "next/headers";
import { alternatesOf } from "@/lib/seo";
import { Download, type System } from "./download";

export const metadata: Metadata = { alternates: alternatesOf("/download") };

const systemOf = (platform: string, userAgent: string, mobile: boolean): System => {
  if (mobile || /Android|iPhone|iPad|iPod/u.test(userAgent)) return "phone";
  if (/CrOS/u.test(userAgent) || /chrome os/iu.test(platform)) return "unknown";
  if (/mac/iu.test(platform) || /Macintosh/u.test(userAgent)) return "mac";
  if (/win/iu.test(platform) || /Windows/u.test(userAgent)) return "windows";
  if (/linux/iu.test(platform) || /Linux|X11/u.test(userAgent)) return "linux";
  return "unknown";
};

export default async function DownloadPage() {
  const request = await headers();
  const userAgent = request.get("user-agent") ?? "";
  const system = systemOf(
    request.get("sec-ch-ua-platform") ?? "",
    userAgent,
    request.get("sec-ch-ua-mobile") === "?1",
  );
  return <Download system={system} arm={/aarch64|arm64/u.test(userAgent)} />;
}
