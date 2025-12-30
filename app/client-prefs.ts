export type AppTheme = "light" | "dark";
export type AppLanguage = "zh-CN" | "en-US";

const THEME_KEY = "appTheme";
const LANG_KEY = "appLanguage";

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const c of cookies) {
    const [k, ...rest] = c.trim().split("=");
    if (!k) continue;
    if (k === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function writeCookieValue(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // 1 year
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
}

export function getInitialTheme(): AppTheme {
  // 让 SSR 首屏也默认深色，避免无痕/首次打开出现“默认浅色/闪白”
  if (typeof window === "undefined") return "dark";

  const stored = window.localStorage.getItem(THEME_KEY) as AppTheme | null;
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  // 无本地偏好时默认深色主题（例如无痕首次打开）
  return "dark";
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, theme);

    // 向全局广播主题变更事件，便于页面/组件订阅并实时更新样式
    window.dispatchEvent(
      new CustomEvent("app-theme-changed", {
        detail: { theme },
      })
    );
  }
}

export function getInitialLanguage(): AppLanguage {
  // Server-side fallback: prefer English unless the client later overrides.
  if (typeof window === "undefined") return "en-US";

  const stored = window.localStorage.getItem(LANG_KEY) as AppLanguage | null;
  if (stored === "zh-CN" || stored === "en-US") {
    return stored;
  }

  // Allow cross-site jump to set language via cookie first (e.g. /api/lang/sync),
  // then we hydrate localStorage from it on initial load.
  const cookieLang = readCookieValue(LANG_KEY) as AppLanguage | null;
  if (cookieLang === "zh-CN" || cookieLang === "en-US") {
    try {
      window.localStorage.setItem(LANG_KEY, cookieLang);
    } catch {
      // ignore
    }
    return cookieLang;
  }

  // No explicit preference found: default to English unless browser is Chinese.
  const navLang = window.navigator.language.toLowerCase();
  if (navLang.startsWith("zh")) return "zh-CN";
  return "en-US";
}

export function applyLanguage(lang: AppLanguage) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_KEY, lang);
    // Keep cookie in sync so server-side redirect endpoints and first-load hydration can align.
    writeCookieValue(LANG_KEY, lang);

    // 向全局广播语言变更事件，便于页面/组件订阅并实时更新文案
    window.dispatchEvent(
      new CustomEvent("app-language-changed", {
        detail: { language: lang },
      })
    );
  }
}


