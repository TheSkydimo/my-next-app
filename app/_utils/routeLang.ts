import type { AppLanguage } from "../api/_utils/appLanguage";

/**
 * Map URL locale segment (e.g. /en, /zh) to internal AppLanguage.
 *
 * Only accept known segments to avoid accidentally turning arbitrary paths into
 * "language pages".
 */
export function resolveAppLanguageFromLocaleSegment(
  segment: string
): AppLanguage | null {
  const v = String(segment ?? "").trim().toLowerCase();

  if (v === "zh" || v === "zh-cn" || v === "zh-hans") return "zh-CN";
  if (v === "en" || v === "en-us") return "en-US";

  return null;
}


