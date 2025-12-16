export type AppTheme = "light" | "dark";
export type AppLanguage = "zh-CN" | "en-US";

const THEME_KEY = "appTheme";
const LANG_KEY = "appLanguage";

export function getInitialTheme(): AppTheme {
  if (typeof window === "undefined") return "dark";

  const stored = window.localStorage.getItem(THEME_KEY) as AppTheme | null;
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, theme);
  }
}

export function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") return "zh-CN";

  const stored = window.localStorage.getItem(LANG_KEY) as AppLanguage | null;
  if (stored === "zh-CN" || stored === "en-US") {
    return stored;
  }

  const navLang = window.navigator.language.toLowerCase();
  if (navLang.startsWith("en")) return "en-US";

  return "zh-CN";
}

export function applyLanguage(lang: AppLanguage) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_KEY, lang);
  }
}


