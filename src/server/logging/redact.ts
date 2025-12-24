function maskIpv4(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
}

function maskIpv6(ip: string): string {
  // Keep the first 4 hextets, mask the rest.
  const parts = ip.split(":");
  const head = parts.slice(0, 4).join(":");
  return `${head}::`;
}

export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v = ip.trim();
  if (!v) return null;
  if (v.includes(".")) return maskIpv4(v);
  if (v.includes(":")) return maskIpv6(v);
  return v;
}

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-forwarded-client-cert",
  "cf-access-jwt-assertion",
  "cf-authorization",
]);

export function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of headers.entries()) {
    const key = k.toLowerCase();
    if (SENSITIVE_HEADERS.has(key)) continue;
    // Avoid very large headers ending up in logs
    out[key] = v.length > 512 ? `${v.slice(0, 512)}…` : v;
  }
  return out;
}

export function safeUrlInfo(url: string): { pathname: string; queryKeys: string[] } {
  try {
    const u = new URL(url);
    return { pathname: u.pathname, queryKeys: [...u.searchParams.keys()] };
  } catch {
    return { pathname: url, queryKeys: [] };
  }
}


