export type AppTheme = "light" | "dark";
export type AppLanguage = "zh-CN" | "en-US";

const THEME_KEY = "appTheme";
const LANG_KEY = "appLanguage";

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

    // 向全局广播语言变更事件，便于页面/组件订阅并实时更新文案
    window.dispatchEvent(
      new CustomEvent("app-language-changed", {
        detail: { language: lang },
      })
    );
  }
}


