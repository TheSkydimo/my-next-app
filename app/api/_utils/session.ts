const SESSION_COOKIE_NAME = "user_session";

function base64UrlEncode(bytes: Uint8Array): string {
  // Cloudflare Workers: btoa expects binary string
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(input: string): Uint8Array<ArrayBuffer> | null {
  try {
    let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    // IMPORTANT:
    // Allocate a real ArrayBuffer so TypeScript won't treat this as ArrayBufferLike (e.g. SharedArrayBuffer),
    // which can break `crypto.subtle.verify` typings during Next.js builds.
    const buffer = new ArrayBuffer(bin.length);
    const out = new Uint8Array(buffer);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out as Uint8Array<ArrayBuffer>;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await importHmacKey(secret);
  const bytes = new TextEncoder().encode(data);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes));
  return base64UrlEncode(sig);
}

async function hmacVerify(secret: string, data: string, sigB64Url: string): Promise<boolean> {
  const key = await importHmacKey(secret);
  const bytes = new TextEncoder().encode(data);
  const sigBytes = base64UrlDecodeToBytes(sigB64Url);
  if (!sigBytes) return false;
  return await crypto.subtle.verify("HMAC", key, sigBytes, bytes);
}

export type SessionPayload = {
  uid: number;
  iat: number;
  exp: number;
  jti: string;
};

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export async function createSessionToken(opts: {
  secret: string;
  userId: number;
  maxAgeSeconds: number;
}): Promise<{ token: string; payload: SessionPayload }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: opts.userId,
    iat: now,
    exp: now + Math.floor(opts.maxAgeSeconds),
    jti: crypto.randomUUID(),
  };

  const json = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(json));
  const sigB64 = await hmacSign(opts.secret, payloadB64);
  return { token: `${payloadB64}.${sigB64}`, payload };
}

export async function verifySessionToken(opts: {
  secret: string;
  token: string;
}): Promise<SessionPayload | null> {
  const token = opts.token.trim();
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const okSig = await hmacVerify(opts.secret, payloadB64, sigB64);
  if (!okSig) return null;

  const bytes = base64UrlDecodeToBytes(payloadB64);
  if (!bytes) return null;
  const json = new TextDecoder().decode(bytes);

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  const p = payload as Partial<SessionPayload>;
  if (
    typeof p.uid !== "number" ||
    typeof p.iat !== "number" ||
    typeof p.exp !== "number" ||
    typeof p.jti !== "string"
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (p.exp <= now) return null;

  return p as SessionPayload;
}


