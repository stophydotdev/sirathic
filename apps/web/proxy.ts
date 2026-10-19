import { type NextRequest, NextResponse } from "next/server";
import { hasLocale, type Locale, LOCALE_COOKIE } from "@/components/locales";

const preferred = (header: string | null): Locale =>
  (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...rest] = part.trim().split(";");
      const weight = Number(
        rest.find((p) => p.startsWith("q="))?.slice(2) ?? 1,
      );
      return { code: tag.split("-")[0]?.toLowerCase() ?? "", weight };
    })
    .toSorted((a, b) => b.weight - a.weight)
    .map(({ code }) => code)
    .find(hasLocale) ?? "en";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (hasLocale(pathname.split("/")[1] ?? "")) return;
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
  const locale = hasLocale(chosen)
    ? chosen
    : preferred(request.headers.get("accept-language"));
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    "/((?!_next|api|trpc|auth|fonts|flags|icon.svg|favicon.ico|robots.txt|sitemap.xml|llms).*)",
  ],
};
