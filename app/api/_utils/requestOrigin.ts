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

function normalizeHostLoose(host: string): string {
  const h = host.trim().toLowerCase();
  // Strip default ports to avoid false mismatches like "example.com" vs "example.com:443".
  if (h.endsWith(":443")) return h.slice(0, -4);
  if (h.endsWith(":80")) return h.slice(0, -3);
  // Some systems may append a trailing dot to FQDNs.
  if (h.endsWith(".")) return h.slice(0, -1);
  return h;
}

/**
 * Lightweight CSRF hardening for cookie-authenticated write endpoints.
 *
 * Policy:
 * - Prefer Fetch Metadata when available:
 *   - `Sec-Fetch-Site: cross-site` => block
 *   - otherwise allow
 * - Fallback: If the request includes an `Origin` header, it must match one of the request hosts
 *   (Host / X-Forwarded-Host / request.url host), after normalizing default ports.
 * - If `Origin` is missing (some non-browser clients), we allow it (compat).
 *
 * Note: This is defense-in-depth; SameSite cookies already reduce CSRF risk.
 */
export function assertSameOriginOrNoOrigin(request: Request): Response | null {
  // Fetch Metadata is more robust under reverse proxies because it reflects the browser's view
  // (origin vs destination) even if the proxy rewrites Host headers upstream.
  const fetchSite = String(
    request.headers.get("sec-fetch-site") ?? request.headers.get("Sec-Fetch-Site") ?? ""
  )
    .trim()
    .toLowerCase();
  if (fetchSite) {
    if (fetchSite === "cross-site") {
      return new Response("Forbidden", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }
    // same-origin / same-site / none / other => allow
    return null;
  }

  const originHeader = request.headers.get("Origin");
  if (!originHeader) return null;

  let originHost = "";
  try {
    originHost = new URL(originHeader).host;
  } catch {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const originNorm = normalizeHostLoose(originHost);
  if (!originNorm) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const hostHeader = firstHeaderValue(request.headers.get("Host"));
  const xForwardedHost = firstHeaderValue(request.headers.get("X-Forwarded-Host"));
  const urlHost = (() => {
    try {
      return new URL(request.url).host;
    } catch {
      return "";
    }
  })();

  // In some OpenNext + Cloudflare deployments, request.url may point to *.workers.dev even for custom domains.
  // That host is not reliable for origin validation; ignore it to avoid false blocks.
  const urlHostTrusted = isWorkersDevHost(urlHost) ? "" : urlHost;

  const allowedHosts = new Set(
    [hostHeader, xForwardedHost, urlHostTrusted]
      .filter(isProbablyValidHost)
      .map(normalizeHostLoose)
      .filter(Boolean)
  );

  // If we cannot determine any trustworthy request host, do not block.
  // (SameSite cookies already reduce CSRF; this guard is defense-in-depth.)
  if (allowedHosts.size === 0) return null;

  if (!allowedHosts.has(originNorm)) {
    // Keep response generic; do not leak host/origin values.
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  return null;
}


