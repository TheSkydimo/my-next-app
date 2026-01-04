export type DateTimeFormatKind = "dateTime" | "date";

export type FormatDateTimeOptions = {
  /**
   * BCP 47 locale (e.g. "zh-CN", "en-US").
   * If omitted, runtime default locale is used.
   */
  locale?: string;
  /**
   * IANA time zone (e.g. "Asia/Shanghai", "America/Los_Angeles").
   * If omitted, runtime default time zone is used.
   */
  timeZone?: string;
  kind?: DateTimeFormatKind;
};

export function getClientTimeZone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function isValidDate(d: Date) {
  return !Number.isNaN(d.getTime());
}

export function formatDateTime(input: string, opts?: FormatDateTimeOptions): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  const d = new Date(raw);
  if (!isValidDate(d)) return raw;

  const kind: DateTimeFormatKind = opts?.kind ?? "dateTime";
  const locale = opts?.locale;
  const timeZone = opts?.timeZone;

  try {
    if (kind === "date") {
      return new Intl.DateTimeFormat(locale, {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    }

    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch {
    // Fallback for invalid locale/timeZone, etc.
    return kind === "date" ? d.toLocaleDateString() : d.toLocaleString();
  }
}


