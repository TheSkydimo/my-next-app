/**
 * Normalize UTC timestamps coming from SQLite/D1 into ISO 8601 with explicit timezone (Z).
 *
 * Why:
 * - D1/SQLite `CURRENT_TIMESTAMP` yields strings like "YYYY-MM-DD HH:MM:SS" (UTC, but no timezone marker).
 * - `new Date("YYYY-MM-DD HH:MM:SS")` is treated as *local time* in browsers, causing timezone drift.
 */

const DB_UTC_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;

export function normalizeDbUtcDateTimeToIso(
  input: string | null | undefined
): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  // Already ISO-like with explicit timezone or offset.
  if (s.includes("T") && (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s))) {
    return s;
  }

  // D1 CURRENT_TIMESTAMP: "YYYY-MM-DD HH:MM:SS(.ffffff)" - interpret as UTC.
  if (DB_UTC_DATETIME_RE.test(s)) {
    return s.replace(" ", "T") + "Z";
  }

  // Fallback: parse if possible (best-effort). NOTE: this may interpret local time for non-ISO inputs.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString();
}


