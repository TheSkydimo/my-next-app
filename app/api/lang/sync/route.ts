import { NextRequest, NextResponse } from "next/server";
import { getRequestOrigin } from "../../_utils/requestOrigin";

type AppLanguage = "zh-CN" | "en-US";

function resolveAppLanguageFromSource(from: string | null): AppLanguage {
  const v = String(from ?? "").trim();
  if (v === "zh" || v === "zh-CN") return "zh-CN";
  // en/ru/tr (and any unknown) -> en-US
  return "en-US";
}

function resolveAppLanguageFromSourceUrl(src: string | null): AppLanguage | null {
  const raw = String(src ?? "").trim();
  if (!raw) return null;
  try {
    // Accept either absolute URL or absolute-path
    const u = raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw)
      : new URL(raw, "https://local.invalid");
    if (u.pathname === "/zh" || u.pathname.startsWith("/zh/")) return "zh-CN";
    // Your requirement: any non-zh source -> English
    return "en-US";
  } catch {
    return null;
  }
}

function resolveAppLanguageFromReferer(referer: string | null): AppLanguage {
  if (!referer) return "en-US";
  try {
    const u = new URL(referer);
    // Only trust the path signal; host can vary (marketing site / docs / etc).
    // Requirement: if user comes from Chinese page -> Chinese; else English.
    if (u.pathname === "/zh" || u.pathname.startsWith("/zh/")) return "zh-CN";
  } catch {
    // ignore invalid URL
  }
  return "en-US";
}

function resolveSafeNextPath(nextParam: string | null): string {
  const raw = String(nextParam ?? "").trim();
  if (!raw) return "/";
  // Prevent open redirect: only allow same-origin absolute-path.
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Language sync endpoint for cross-site jumps (marketing site -> members/admin).
 *
 * Usage:
 *   GET /api/lang/sync?src=/zh/changelog&next=/login   -> sets zh-CN
 *   GET /api/lang/sync?src=/ru/changelog&next=/        -> sets en-US
 *   GET /api/lang/sync?src=https://skydimo.com/zh/...  -> sets zh-CN
 *   GET /api/lang/sync?from=zh&next=/login             -> sets zh-CN (explicit override)
 *   GET /api/lang/sync?next=/                          -> falls back to Referer detection
 *
 * Behavior:
 * - Sets cookie `appLanguage` to `zh-CN` or `en-US`
 * - Redirects (307) to `next` (same-origin path only)
 * - `Cache-Control: no-store`
 */
export function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const src = request.nextUrl.searchParams.get("src");
  const nextPath = resolveSafeNextPath(request.nextUrl.searchParams.get("next"));

  const lang: AppLanguage = (() => {
    // Priority:
    // 1) explicit `from`
    // 2) explicit source URL/path `src` (e.g. /zh/changelog)
    // 3) Referer header
    if (from && from.length > 0) return resolveAppLanguageFromSource(from);
    const bySrc = resolveAppLanguageFromSourceUrl(src);
    if (bySrc) return bySrc;
    return resolveAppLanguageFromReferer(request.headers.get("referer"));
  })();

  const origin = getRequestOrigin(request);
  const res = NextResponse.redirect(new URL(nextPath, origin), 307);
  res.headers.set("Cache-Control", "no-store");

  // Language preference is not sensitive; keep it readable by client JS
  // so it can sync into localStorage on first load.
  res.cookies.set({
    name: "appLanguage",
    value: lang,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return res;
}


