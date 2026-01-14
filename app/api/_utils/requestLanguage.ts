import { normalizeAppLanguage, type AppLanguage } from "./appLanguage";

/**
 * Resolve request language for API responses.
 *
 * Priority:
 * 1) Explicit body language (when provided by clients)
 * 2) Query param `?lang=` (useful for simple clients / debugging)
 * 3) `Accept-Language` header (simple heuristic)
 * 4) Default: zh-CN
 */
export function resolveRequestLanguage(opts: {
  request: Request;
  bodyLanguage?: unknown;
}): AppLanguage {
  const { request, bodyLanguage } = opts;

  // 1) client explicit language
  if (bodyLanguage === "en-US" || bodyLanguage === "zh-CN") {
    return normalizeAppLanguage(bodyLanguage);
  }

  // 2) query param
  try {
    const url = new URL(request.url);
    const langParam = url.searchParams.get("lang");
    if (langParam === "en-US" || langParam === "zh-CN") return langParam;
  } catch {
    // ignore
  }

  // 3) Accept-Language fallback (simple heuristic)
  const accept = String(request.headers.get("accept-language") ?? "")
    .trim()
    .toLowerCase();
  if (accept.startsWith("en") || accept.includes(",en") || accept.includes("-en")) {
    return "en-US";
  }

  return "zh-CN";
}

