function isLocalhostHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function getHeaderFirstValue(headerValue: string | null): string {
  if (!headerValue) return "";
  return headerValue.split(",")[0]?.trim() ?? "";
}

function parseForwardedProto(forwarded: string): string | null {
  // Forwarded: for=...,proto=https;host=...
  // We only care about proto=...
  const parts = forwarded.split(";");
  for (const part of parts) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k?.toLowerCase() === "proto" && v) {
      return v.replace(/^"|"$/g, "").toLowerCase();
    }
  }
  return null;
}

function parseCfVisitorScheme(cfVisitor: string): string | null {
  // cf-visitor: {"scheme":"https"}
  try {
    const obj = JSON.parse(cfVisitor) as { scheme?: string };
    if (typeof obj.scheme === "string") return obj.scheme.toLowerCase();
  } catch {
    // ignore
  }
  return null;
}

export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);

  // Prefer proxy headers (common in deployments)
  const xfp = getHeaderFirstValue(request.headers.get("X-Forwarded-Proto")).toLowerCase();
  if (xfp === "https") return true;
  if (xfp === "http") return false;

  const forwarded = request.headers.get("Forwarded");
  if (forwarded) {
    const proto = parseForwardedProto(forwarded);
    if (proto === "https") return true;
    if (proto === "http") return false;
  }

  const cfVisitor = request.headers.get("cf-visitor");
  if (cfVisitor) {
    const scheme = parseCfVisitorScheme(cfVisitor);
    if (scheme === "https") return true;
    if (scheme === "http") return false;
  }

  // Fall back to the URL itself
  if (url.protocol === "https:") return true;

  // Explicitly treat localhost as insecure unless headers proved otherwise
  if (isLocalhostHostname(url.hostname)) return false;

  return false;
}


