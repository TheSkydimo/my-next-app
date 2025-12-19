export function isR2SchemeUrl(value: string): boolean {
  return value.startsWith("r2://");
}

export function r2KeyFromSchemeUrl(value: string): string | null {
  if (!isR2SchemeUrl(value)) return null;
  const key = value.slice("r2://".length);
  return key ? key : null;
}

export function makeR2SchemeUrl(key: string): string {
  return `r2://${key}`;
}

export function makeAvatarImageApiUrlFromR2Key(key: string): string {
  return `/api/avatar/image?key=${encodeURIComponent(key)}`;
}

export function convertDbAvatarUrlToPublicUrl(dbUrl: string | null): string | null {
  if (!dbUrl) return null;
  const key = r2KeyFromSchemeUrl(dbUrl);
  if (key) {
    return makeAvatarImageApiUrlFromR2Key(key);
  }
  return dbUrl;
}


