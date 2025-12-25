import { isSecureRequest } from "./request";

function firstHeaderValue(value: string | null): string {
  if (!value) return "";
  return value.split(",")[0]?.trim() ?? "";
}

function isProbablyValidHost(host: string): boolean {
  // Allow hostname[:port]. Reject anything with scheme/path/whitespace/control chars.
  const h = host.trim();
  if (!h) return false;
  if (h.includes("://")) return false;
  if (/[\/\s\x00-\x1F\x7F]/.test(h)) return false;
  return true;
}

function isWorkersDevHost(host: string): boolean {
  const h = host.toLowerCase();
  // tolerate optional port: my-app.workers.dev:443
  const withoutPort = h.split(":")[0] ?? h;
  return withoutPort.endsWith(".workers.dev");
}

/**
 * Build an absolute origin (scheme + host) from proxy headers.
 *
 * Why:
 * In some Cloudflare/OpenNext deployments, `request.url` may point to the default
 * `*.workers.dev` host even when the end-user visited a custom domain.
 * For redirects we want to preserve the user-facing host (`Host`/`X-Forwarded-Host`).
 */
export function getRequestOrigin(request: Request): string {
  const hostHeader = firstHeaderValue(request.headers.get("Host"));
  const xForwardedHost = firstHeaderValue(request.headers.get("X-Forwarded-Host"));
  const urlHost = new URL(request.url).host;

  const candidates = [hostHeader, xForwardedHost, urlHost].filter(isProbablyValidHost);

  // Prefer a non-*.workers.dev host when available (custom domains).
  const preferred =
    candidates.find((h) => !isWorkersDevHost(h)) ??
    candidates[0] ??
    urlHost;

  const scheme = isSecureRequest(request) ? "https" : "http";
  return `${scheme}://${preferred}`;
}


