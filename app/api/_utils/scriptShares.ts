export const SCRIPT_SHARE_FILE_EXT = ".skmode";
export const SCRIPT_SHARE_R2_PREFIX = "script-shares/";

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


