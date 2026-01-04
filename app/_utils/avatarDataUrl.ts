export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Returns true for `data:image/*;base64,...` (common avatar pasted from clipboard).
 */
export function isImageDataUrl(input: string): boolean {
  const s = String(input || "").trim();
  return /^data:image\/[^;]+;base64,/i.test(s);
}

/**
 * Estimates decoded bytes of a base64 payload from a data URL.
 * Returns null if not a valid base64 data URL.
 */
export function estimateImageDataUrlBytes(dataUrl: string): number | null {
  const s = String(dataUrl || "").trim();
  const match = s.match(/^data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  const b64 = match[1] || "";
  // Base64 decoded length:
  // bytes = (len * 3)/4 - padding
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

/**
 * Uploads an image data URL to the server and returns dbUrl/publicUrl.
 * Server will enforce mime type and size limits.
 */
export async function uploadAvatarDataUrl(dataUrl: string): Promise<{
  dbUrl: string;
  publicUrl?: string;
}> {
  const res = await fetch("/api/avatar/upload", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Upload failed");
  }

  const data = (await res.json().catch(() => null)) as
    | { dbUrl?: string; publicUrl?: string }
    | null;

  if (!data?.dbUrl) throw new Error("Upload failed");
  return { dbUrl: data.dbUrl, publicUrl: data.publicUrl };
}


