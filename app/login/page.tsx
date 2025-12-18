"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  getInitialTheme,
  type AppLanguage,
  type AppTheme,
} from "../client-prefs";

type PrimaryColorKey = "blue" | "purple" | "magenta" | "gold" | "green" | "gray";
type AlignMode = "left" | "center" | "right";
type Lang = "zh-CN" | "en";

const TEXTS: Record<Lang, {
  heroBadge: string;
  heroTitlePrefix: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  heroTips: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  loginButton: string;
  noAccount: string;
  goRegister: string;
  forgot: string;
  recover: string;
  loginError: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
}> = {
  "zh-CN": {
    heroBadge: "开箱即用 · 中后台管理模板",
    heroTitlePrefix: "欢迎回来，",
    heroTitleHighlight: "开始你的控制台之旅",
    heroSubtitle: "工程化 · 高性能 · 深色主题，为大型中后台系统而生。",
    heroTips: "支持账号密码、邮箱验证码等多种登录方式",
    welcomeTitle: "欢迎回来 👋",
    welcomeSubtitle: "请输入您的账号信息开始管理项目",
    emailLabel: "邮箱",
    emailPlaceholder: "name@example.com",
    passwordLabel: "密码",
    passwordPlaceholder: "请输入登录密码",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    loginButton: "登录",
    noAccount: "还没有账号？",
    goRegister: "创建一个新账号",
    forgot: "忘记密码？",
    recover: "找回密码",
    loginError: "邮箱或密码错误",
    alignLeft: "居左",
    alignCenter: "居中",
    alignRight: "居右",
  },
  en: {
    heroBadge: "Out-of-the-box admin template",
    heroTitlePrefix: "Welcome back,",
    heroTitleHighlight: "start your dashboard journey",
    heroSubtitle: "Engineered, high‑performance dark theme for large admin systems.",
    heroTips: "Supports password login and email verification login.",
    welcomeTitle: "Welcome back 👋",
    welcomeSubtitle: "Enter your account details to start managing projects.",
    emailLabel: "Email",
    emailPlaceholder: "name@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    loginButton: "Log in",
    noAccount: "No account yet?",
    goRegister: "Create one",
    forgot: "Forgot password?",
    recover: "Recover password",
    loginError: "Incorrect email or password",
    alignLeft: "Left",
    alignCenter: "Center",
    alignRight: "Right",
  },
};

const PRIMARY_COLORS: { key: PrimaryColorKey; color: string }[] = [
  { key: "blue", color: "#3b82f6" },
  { key: "purple", color: "#8b5cf6" },
  { key: "magenta", color: "#ec4899" },
  { key: "gold", color: "#eab308" },
  { key: "green", color: "#22c55e" },
  { key: "gray", color: "#6b7280" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [primary, setPrimary] = useState<PrimaryColorKey>("green");
  const [align, setAlign] = useState<AlignMode>("center");
  const [lang, setLang] = useState<Lang>("zh-CN");
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const t = TEXTS[lang];

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 统一使用全局主题 / 语言首选项（与用户端 / 管理端保持一致）
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const initialAppLang = getInitialLanguage();
    const initialLang: Lang = initialAppLang === "en-US" ? "en" : "zh-CN";
    setLang(initialLang);

    const storedPrimary = window.localStorage.getItem("authPrimary") as PrimaryColorKey | null;
    if (storedPrimary && PRIMARY_COLORS.some((c) => c.key === storedPrimary)) {
      setPrimary(storedPrimary);
    }

    const storedAlign = window.localStorage.getItem("authAlign") as AlignMode | null;
    if (storedAlign === "left" || storedAlign === "center" || storedAlign === "right") {
      setAlign(storedAlign);
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: AppTheme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  };

  const changePrimary = (key: PrimaryColorKey) => {
    setPrimary(key);
    setColorMenuOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("authPrimary", key);
    }
  };

  const changeAlign = (mode: AlignMode) => {
    setAlign(mode);
    setAlignMenuOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("authAlign", mode);
    }
  };

  const changeLang = (value: Lang) => {
    setLang(value);
    setLangMenuOpen(false);

    // 将登录页语言切换同步到全局 App 语言（用于后续页面）
    const appLang: AppLanguage = value === "en" ? "en-US" : "zh-CN";
    applyLanguage(appLang);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      setError(t.loginError);
      return;
    }

    const data = (await res.json()) as {
      ok: boolean;
      user: {
        id: number;
        username: string;
        email: string;
        avatarUrl: string | null;
        isAdmin: boolean;
      };
    };

    // 登录成功：保存完整用户信息到 localStorage，避免进入后台后再次请求加载
    if (typeof window !== "undefined") {
      window.localStorage.setItem("loggedInUserEmail", data.user.email);
      window.localStorage.setItem("loggedInUserName", data.user.username);
      if (data.user.avatarUrl) {
        window.localStorage.setItem("loggedInUserAvatar", data.user.avatarUrl);
      } else {
        window.localStorage.removeItem("loggedInUserAvatar");
      }
    }

    // 登录成功后跳转首页
    window.location.href = "/";
  };

  return (
    <div
      className={`auth-page auth-page--split auth-page--${theme} auth-page--primary-${primary} auth-page--align-${align}`}
    >
      <div className="auth-page__split-shell">
        <div className="auth-toolbar">
          <div className="auth-toolbar__icon-group">
            <div className="auth-toolbar__icon-wrapper">
              <button
                type="button"
                className="auth-toolbar__icon-button"
                onClick={() => setColorMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={colorMenuOpen}
                aria-label="切换主题主色"
              >
                🎨
              </button>
              {colorMenuOpen && (
                <div className="auth-toolbar__dropdown auth-toolbar__dropdown--colors">
                  <div className="auth-toolbar__colors" aria-label="切换主色">
                    {PRIMARY_COLORS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`auth-toolbar__color-dot${
                          primary === item.key ? " auth-toolbar__color-dot--active" : ""
                        }`}
                        style={{ backgroundColor: item.color }}
                        onClick={() => changePrimary(item.key)}
                        aria-label={item.key}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="auth-toolbar__icon-wrapper">
              <button
                type="button"
                className={`auth-toolbar__icon-button auth-toolbar__icon-button--layout auth-toolbar__icon-button--layout-${align}`}
                onClick={() => setAlignMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={alignMenuOpen}
                aria-label="切换布局位置"
              >
                <span className="auth-toolbar__layout-bar auth-toolbar__layout-bar--left" />
                <span className="auth-toolbar__layout-bar auth-toolbar__layout-bar--center" />
                <span className="auth-toolbar__layout-bar auth-toolbar__layout-bar--right" />
              </button>
              {alignMenuOpen && (
                <div className="auth-toolbar__dropdown">
                  <button
                    type="button"
                    className={`auth-toolbar__dropdown-item${
                      align === "left" ? " auth-toolbar__dropdown-item--active" : ""
                    }`}
                    onClick={() => changeAlign("left")}
                  >
                    {t.alignLeft}
                  </button>
                  <button
                    type="button"
                    className={`auth-toolbar__dropdown-item${
                      align === "center" ? " auth-toolbar__dropdown-item--active" : ""
                    }`}
                    onClick={() => changeAlign("center")}
                  >
                    {t.alignCenter}
                  </button>
                  <button
                    type="button"
                    className={`auth-toolbar__dropdown-item${
                      align === "right" ? " auth-toolbar__dropdown-item--active" : ""
                    }`}
                    onClick={() => changeAlign("right")}
                  >
                    {t.alignRight}
                  </button>
                </div>
              )}
            </div>

            <div className="auth-toolbar__icon-wrapper">
              <button
                type="button"
                className="auth-toolbar__icon-button"
                onClick={() => setLangMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={langMenuOpen}
                aria-label={lang === "zh-CN" ? "切换语言" : "Change language"}
              >
                <Image
                  src="/translate.svg"
                  alt={lang === "zh-CN" ? "语言" : "Language"}
                  width={16}
                  height={16}
                />
              </button>
              {langMenuOpen && (
                <div className="auth-toolbar__dropdown">
                  <button
                    type="button"
                    className={`auth-toolbar__dropdown-item${
                      lang === "zh-CN" ? " auth-toolbar__dropdown-item--active" : ""
                    }`}
                    onClick={() => changeLang("zh-CN")}
                  >
                    简体中文
                  </button>
                  <button
                    type="button"
                    className={`auth-toolbar__dropdown-item${
                      lang === "en" ? " auth-toolbar__dropdown-item--active" : ""
                    }`}
                    onClick={() => changeLang("en")}
                  >
                    English
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="auth-toolbar__icon-button auth-toolbar__icon-button--theme"
              onClick={toggleTheme}
              aria-label="切换浅色/深色主题"
            >
              {theme === "dark" ? "☀" : "🌙"}
            </button>
          </div>
        </div>
        <section className="auth-page__visual">
          <div className="auth-page__visual-inner">
            {/* 去掉顶部徽标文案，只保留主标题和副标题 */}
            <h1 className="auth-page__title">
              {t.heroTitlePrefix}
              <span className="auth-page__title-highlight">{t.heroTitleHighlight}</span>
            </h1>
            <p className="auth-page__subtitle">
              {t.heroSubtitle}
            </p>

            <div className="auth-page__visual-graphic">
              <div className="auth-page__visual-orbit" />
              <div className="auth-page__visual-card">
                <Image
                  src="/globe.svg"
                  alt="控制台可视化预览"
                  width={220}
                  height={220}
                  className="auth-page__visual-image"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section className="auth-page__panel">
          <div className="auth-card auth-card--login">
            <header className="auth-card__header">
              <h1>{t.welcomeTitle}</h1>
              <p>{t.welcomeSubtitle}</p>
            </header>

            <form onSubmit={submit} className="auth-card__form">
              <label className="auth-card__field">
                <span className="auth-card__label">{t.emailLabel}</span>
                <input
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="auth-card__field">
                <div className="auth-card__field-row auth-card__field-row--label">
                  <span className="auth-card__label">{t.passwordLabel}</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="auth-card__ghost-button auth-card__ghost-button--link"
                  >
                    {showPassword ? t.hidePassword : t.showPassword}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-card__field-grow"
                  required
                />
              </label>

              <button type="submit" className="auth-card__submit-button">
                {t.loginButton}
              </button>
            </form>

            <div className="auth-card__links">
              <p>
                {t.noAccount} <Link href="/register">{t.goRegister}</Link>
              </p>
              <p>
                {t.forgot} <Link href="/forgot-password">{t.recover}</Link>
              </p>
            </div>

            {error && <p className="auth-card__error">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
