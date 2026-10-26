import { type NextRequest, NextResponse } from "next/server";
import { hasLocale, type Locale, LOCALE_COOKIE } from "@/components/locales";

const preferred = (header: string | null): Locale =>
  (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...rest] = part.trim().split(";");
      const weight = Number(rest.find((p) => p.startsWith("q="))?.slice(2) ?? 1);
      return { code: tag.split("-")[0]?.toLowerCase() ?? "", weight };
    })
    .toSorted((a, b) => b.weight - a.weight)
    .map(({ code }) => code)
    .find(hasLocale) ?? "en";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first = "", ...rest] = pathname.split("/");
  if (hasLocale(first)) {
    request.nextUrl.pathname = `/${rest.join("/")}`;
    const response = NextResponse.redirect(request.nextUrl);
    response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
    return response;
  }
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
  const locale = hasLocale(chosen) ? chosen : preferred(request.headers.get("accept-language"));
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.rewrite(request.nextUrl);
  response.headers.set("vary", "Cookie, Accept-Language");
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|trpc|auth|fonts|flags|icon.svg|favicon.ico|robots.txt|sitemap.xml).*)"],
};
