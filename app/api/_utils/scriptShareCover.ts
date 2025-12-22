import { normalizeAppLanguage, type AppLanguage } from "./appLanguage";

export const SCRIPT_SHARE_COVER_R2_PREFIX = "script-share-covers/";

export function buildScriptShareCoverR2Key(id: string): string {
  return `${SCRIPT_SHARE_COVER_R2_PREFIX}${id}.svg`;
}

function escapeXml(input: string): string {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// Deterministic 32-bit FNV-1a
function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashToHue(hash32: number): number {
  return hash32 % 360;
}

function normalizeLinesForCover(scriptText: string): string[] {
  const raw = String(scriptText ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = raw.split("\n");

  const picked: string[] = [];
  for (const line of lines) {
    const s = line.replaceAll("\t", "  ").trimEnd();
    if (!s.trim()) continue;
    picked.push(s);
    if (picked.length >= 12) break;
  }

  if (picked.length === 0) {
    return ["-- (empty)"];
  }

  // Cap each line length to avoid overly wide SVGs.
  return picked.map((l) => (l.length > 80 ? `${l.slice(0, 80)}…` : l));
}

export function decodeScriptTextPreview(buffer: ArrayBuffer, maxBytes = 64 * 1024): string {
  const slice = buffer.byteLength > maxBytes ? buffer.slice(0, maxBytes) : buffer;
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    // Should never happen in Workers, but keep it safe.
    return "";
  }
}

export function generateScriptShareCoverSvg(options: {
  id: string;
  effectName: string;
  publicUsername: string;
  lang: unknown;
  scriptText: string;
}): { svg: string; mimeType: string; lang: AppLanguage } {
  const lang = normalizeAppLanguage(options.lang);
  const effectName = String(options.effectName ?? "").trim() || (lang === "zh-CN" ? "未命名脚本" : "Untitled script");
  const publicUsername = String(options.publicUsername ?? "").trim() || (lang === "zh-CN" ? "匿名" : "Anonymous");

  const codeLines = normalizeLinesForCover(options.scriptText);

  const seed = `${options.id}|${effectName}|${publicUsername}|${codeLines.join("\n")}`;
  const hue = hashToHue(fnv1a32(seed));

  // 1200x630 is a common social-card ratio; also looks good as a cover.
  const W = 1200;
  const H = 630;
  const pad = 56;

  const title = escapeXml(effectName);
  const authorLabel = lang === "zh-CN" ? "作者" : "By";
  const author = escapeXml(publicUsername);
  const idLabel = "ID";
  const id = escapeXml(options.id);

  // Background gradient based on hue.
  const bg1 = `hsl(${hue}, 85%, 52%)`;
  const bg2 = `hsl(${(hue + 45) % 360}, 85%, 45%)`;

  const codeY = 270;
  const lineHeight = 30;

  const codeText = codeLines
    .map((l, idx) => {
      const y = codeY + idx * lineHeight;
      return `<text x="${pad + 28}" y="${y}" fill="rgba(226,232,240,0.92)" font-size="22" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace">${escapeXml(l)}</text>`;
    })
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}" stop-opacity="0.95" />
      <stop offset="1" stop-color="${bg2}" stop-opacity="0.92" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="rgba(0,0,0,0.45)" />
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)" />
  <circle cx="${W - 120}" cy="110" r="140" fill="rgba(255,255,255,0.10)" />
  <circle cx="${W - 60}" cy="180" r="90" fill="rgba(255,255,255,0.08)" />

  <g filter="url(#shadow)">
    <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" rx="28" fill="rgba(2,6,23,0.86)" stroke="rgba(148,163,184,0.22)" />
  </g>

  <text x="${pad + 28}" y="${pad + 62}" fill="#f8fafc" font-size="46" font-weight="700" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">${title}</text>
  <text x="${pad + 28}" y="${pad + 104}" fill="rgba(226,232,240,0.86)" font-size="22" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">${authorLabel}: ${author}  ·  ${idLabel}: ${id}</text>

  <g>
    <rect x="${pad + 18}" y="${pad + 138}" width="${W - pad * 2 - 36}" height="${H - pad * 2 - 168}" rx="18" fill="rgba(15,23,42,0.75)" stroke="rgba(148,163,184,0.18)" />
    <text x="${pad + 28}" y="${pad + 182}" fill="rgba(148,163,184,0.85)" font-size="18" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace">-- Lua preview</text>
    ${codeText}
  </g>

  <text x="${W - pad}" y="${H - pad + 18}" text-anchor="end" fill="rgba(226,232,240,0.55)" font-size="14" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">Generated from script content</text>
</svg>`;

  return { svg, mimeType: "image/svg+xml", lang };
}


