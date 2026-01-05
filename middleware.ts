import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Keep in sync with `app/api/_utils/adminModeCookie.ts`.
const ADMIN_MODE_COOKIE_NAME = "skydimo_admin_mode";

/**
 * Default landing page:
 * - Visiting `/` should not render the old "home" content.
 * - Redirect to app entry (cookie-dependent; MUST NOT be permanent).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminMode = request.cookies.get(ADMIN_MODE_COOKIE_NAME)?.value === "1";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

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
        : isAdminMode
          ? "/admin"
          : "/orders";

    // Defense-in-depth: ensure `next` is a same-origin absolute-path.
    let safeNext =
      next.startsWith("/") && !next.startsWith("//") ? next : "/orders";

    // Admin-mode: always prefer admin app, regardless of locale-prefixed entry links.
    if (isAdminMode && !safeNext.startsWith("/admin")) {
      safeNext = "/admin";
    }

    const from = seg.startsWith("zh") ? "zh" : "en";
    const u = new URL("/api/lang/sync", request.url);
    u.searchParams.set("from", from);
    u.searchParams.set("next", safeNext);
    return NextResponse.redirect(u, 307);
  }

  // Admin-mode: avoid landing on user routes (they will render user-side profile via /api/user/me).
  // This cookie is only a "mode hint" (not auth), so /admin/* will still enforce real admin auth.
  if (isAdminMode && !isAdminRoute) {
    // Use a temporary redirect so disabling admin-mode immediately takes effect.
    return NextResponse.redirect(new URL("/admin", request.url), 307);
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isAdminMode ? "/admin" : "/orders", request.url),
      307
    );
  }

  return NextResponse.next();
}

export const config = {
  // Run on all pages except API routes and static assets.
  matcher: ["/((?!api|_next/|favicon\\.ico$|favicon\\.png$|logo\\.png$).*)"],
};


