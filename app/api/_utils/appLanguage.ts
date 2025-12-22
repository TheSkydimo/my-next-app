export type AppLanguage = "zh-CN" | "en-US";

export function normalizeAppLanguage(input: unknown): AppLanguage {
  const v = String(input ?? "").trim();
  if (v === "en-US") return "en-US";
  return "zh-CN";
}


