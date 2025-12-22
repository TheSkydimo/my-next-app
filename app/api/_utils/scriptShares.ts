export const SCRIPT_SHARE_FILE_EXT = ".skmode";
export const SCRIPT_SHARE_R2_PREFIX = "script-shares/";

export async function sha256HexFromArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function containsCjkCharacters(input: string): boolean {
  // Basic CJK ranges: CJK Unified Ideographs + Extension A + Compatibility Ideographs
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(input);
}

export function isAllowedScriptFilename(name: string): boolean {
  const n = (name || "").trim().toLowerCase();
  return n.endsWith(SCRIPT_SHARE_FILE_EXT);
}

export function sanitizeDisplayText(input: string, maxLen: number): string {
  // Keep it simple: trim, collapse whitespace, cap length.
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function buildScriptShareR2Key(id: string): string {
  return `${SCRIPT_SHARE_R2_PREFIX}${id}${SCRIPT_SHARE_FILE_EXT}`;
}

export function safeDownloadFilename(effectName: string): string {
  const base = sanitizeDisplayText(effectName, 80) || "script";
  // Replace path separators and other problematic chars.
  const cleaned = base.replace(/[\\\/:*?"<>|]+/g, "-").trim();
  return `${cleaned || "script"}${SCRIPT_SHARE_FILE_EXT}`;
}


