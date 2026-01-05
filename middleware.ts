import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Default landing page:
 * - Visiting `/` should not render the old "home" content.
 * - Permanently redirect to `/orders` (301) as the app entry.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Locale-prefixed paths (marketing site uses /zh, /en, etc).
  // We do NOT serve a locale-prefixed routing tree; we only use it as a signal to
  // sync language preference, then redirect to the non-prefixed route.
  //
  // Examples:
  // - /zh           -> /api/lang/sync?from=zh&next=/orders
  // - /zh/orders    -> /api/lang/sync?from=zh&next=/orders
  // - /en/profile   -> /api/lang/sync?from=en&next=/profile
  const localeMatch = pathname.match(
    /^\/(zh|zh-cn|zh-hans|en|en-us)(\/.*)?$/i
  );
  if (localeMatch) {
    const seg = String(localeMatch[1] ?? "").toLowerCase();
    const next =
      typeof localeMatch[2] === "string" && localeMatch[2] && localeMatch[2] !== "/"
        ? localeMatch[2]
        : "/orders";

    // Defense-in-depth: ensure `next` is a same-origin absolute-path.
    const safeNext =
      next.startsWith("/") && !next.startsWith("//") ? next : "/orders";

    const from = seg.startsWith("zh") ? "zh" : "en";
    const u = new URL("/api/lang/sync", request.url);
    u.searchParams.set("from", from);
    u.searchParams.set("next", safeNext);
    return NextResponse.redirect(u, 307);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/orders", request.url), 301);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all pages except API routes and static assets.
  matcher: ["/((?!api|_next/|favicon\\.ico$|favicon\\.png$|logo\\.png$).*)"],
};


