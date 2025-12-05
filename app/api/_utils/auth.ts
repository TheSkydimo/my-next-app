export async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidEmail(email: string): boolean {
  // 这里只做一个基础校验，避免引入额外依赖
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


