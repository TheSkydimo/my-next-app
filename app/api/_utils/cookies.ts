export type CookieSerializeOptions = {
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
};

export function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};

  const parts = header.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(val);
  }

  return out;
}

export function getRequestCookie(request: Request, name: string): string | null {
  const cookies = parseCookieHeader(request.headers.get("Cookie"));
  return cookies[name] ?? null;
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieSerializeOptions = {}
): string {
  const parts: string[] = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);

  if (options.maxAge != null) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join("; ");
}


