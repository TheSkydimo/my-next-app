type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const YMD_HMS_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

export function isValidIanaTimeZone(tz: string): boolean {
  const s = String(tz ?? "").trim();
  if (!s || s.length > 64) return false;
  try {
    // Throws RangeError if tz is invalid.
    // Use a stable locale and options to avoid polyfill quirks.
    new Intl.DateTimeFormat("en-US", { timeZone: s }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function parseYmdHms(input: string): DateParts | null {
  const s = String(input ?? "").trim();
  const m = s.match(YMD_HMS_RE);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? "0");
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }
  // Basic range checks (not a full calendar validation).
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;
  return { year, month, day, hour, minute, second };
}

function getTimeZoneOffsetMs(timeZone: string, dateUtc: Date): number {
  // Format the UTC instant *as if* in the target time zone, then compute the offset.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(dateUtc);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);

  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");

  const asUtcMs = Date.UTC(y, m - 1, d, hh, mm, ss);
  return asUtcMs - dateUtc.getTime();
}

/**
 * Convert a local date/time (expressed as components *in* the given IANA time zone)
 * into a UTC ISO string, DST-safe (best-effort).
 *
 * This mirrors the behavior of date-fns-tz `fromZonedTime` without adding a dependency.
 */
export function zonedDateTimeToUtcIso(parts: DateParts, timeZone: string): string {
  // First guess: interpret components as UTC.
  const guessMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const guess = new Date(guessMs);

  // Compute offset at the guessed instant and adjust.
  const offset1 = getTimeZoneOffsetMs(timeZone, guess);
  const utc1 = new Date(guessMs - offset1);

  // Second pass for DST transitions (offset may differ after adjustment).
  const offset2 = getTimeZoneOffsetMs(timeZone, utc1);
  const utc2 = new Date(guessMs - offset2);

  return utc2.toISOString();
}

/**
 * Try to convert an AI/ocr date-time string like "YYYY-MM-DD HH:MM:SS" (no tz)
 * into UTC ISO using the uploader's IANA time zone.
 */
export function tryConvertLocalYmdHmsToUtcIso(
  input: string | null | undefined,
  uploaderTimeZone: string | null
): string | null {
  if (!input) return null;
  const tz = String(uploaderTimeZone ?? "").trim();
  if (!tz || !isValidIanaTimeZone(tz)) return null;
  const p = parseYmdHms(String(input));
  if (!p) return null;
  try {
    return zonedDateTimeToUtcIso(p, tz);
  } catch {
    return null;
  }
}


