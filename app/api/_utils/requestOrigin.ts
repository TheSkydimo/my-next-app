import { isSecureRequest } from "./request";

function firstHeaderValue(value: string | null): string {
  if (!value) return "";
  return value.split(",")[0]?.trim() ?? "";
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
  const host =
    firstHeaderValue(request.headers.get("X-Forwarded-Host")) ||
    firstHeaderValue(request.headers.get("Host")) ||
    new URL(request.url).host;

  const scheme = isSecureRequest(request) ? "https" : "http";
  return `${scheme}://${host}`;
}


