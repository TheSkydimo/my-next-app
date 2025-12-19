export function generateNumericUsername(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let out = "";
  for (let i = 0; i < length; i++) {
    out += String(bytes[i] % 10);
  }

  // 避免以 0 开头（体验更像“账号”）
  if (out.startsWith("0")) {
    out = String((bytes[0] % 9) + 1) + out.slice(1);
  }

  return out;
}


