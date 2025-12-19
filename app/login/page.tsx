"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { TurnstileWidget } from "../components/TurnstileWidget";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  getInitialTheme,
  type AppLanguage,
  type AppTheme,
} from "../client-prefs";

type PrimaryColorKey = "blue" | "purple" | "magenta" | "gold" | "green" | "gray";
type Lang = "zh-CN" | "en";

const TEXTS: Record<Lang, {
  heroTitlePrefix: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailCodeLabel: string;
  emailCodePlaceholder: string;
  sendCodeButton: string;
  sendingCodeButton: string;
  loginButton: string;
  loginError: string;
  errorEmailRequired: string;
  errorTurnstileRequired: string;
  errorTurnstileLoadFailed: string;
  errorSendCode: string;
  successCodeSent: string;
  errorCodeRequired: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
}> = {
  "zh-CN": {
    heroTitlePrefix: "欢迎回来，",
    heroTitleHighlight: "开始你的控制台之旅",
    heroSubtitle: "工程化 · 高性能 · 深色主题，为大型中后台系统而生。",
    welcomeTitle: "邮箱验证登录",
    welcomeSubtitle: "无需密码：邮箱 + 人机验证 + 验证码即可登录/注册",
    emailLabel: "邮箱",
    emailPlaceholder: "name@example.com",
    emailCodeLabel: "邮箱验证码",
    emailCodePlaceholder: "请输入 6 位验证码",
    sendCodeButton: "发送验证码",
    sendingCodeButton: "发送中...",
    loginButton: "登录 / 注册",
    loginError: "登录失败，请检查验证码是否正确",
    errorEmailRequired: "请先填写邮箱",
    errorTurnstileRequired: "请完成人机验证后再发送验证码",
    errorTurnstileLoadFailed: "人机验证加载失败，请刷新页面重试",
    errorSendCode: "发送邮箱验证码失败",
    successCodeSent: "验证码已发送到邮箱，请注意查收",
    errorCodeRequired: "请输入邮箱验证码",
    alignLeft: "居左",
    alignCenter: "居中",
    alignRight: "居右",
  },
  en: {
    heroTitlePrefix: "Welcome back,",
    heroTitleHighlight: "start your dashboard journey",
    heroSubtitle: "Engineered, high‑performance dark theme for large admin systems.",
    welcomeTitle: "Email sign-in",
    welcomeSubtitle: "Passwordless: email + verification + code to sign in/sign up",
    emailLabel: "Email",
    emailPlaceholder: "name@example.com",
    emailCodeLabel: "Email code",
    emailCodePlaceholder: "Enter the 6-digit code",
    sendCodeButton: "Send code",
    sendingCodeButton: "Sending...",
    loginButton: "Sign in / Sign up",
    loginError: "Sign-in failed. Please check the code.",
    errorEmailRequired: "Please enter your email first",
    errorTurnstileRequired: "Please complete verification before sending the code",
    errorTurnstileLoadFailed: "Verification failed to load. Please refresh and try again.",
    errorSendCode: "Failed to send email code",
    successCodeSent: "Code sent. Please check your inbox.",
    errorCodeRequired: "Please enter the email code",
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
  const [emailCode, setEmailCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoadFailed, setTurnstileLoadFailed] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [primary, setPrimary] = useState<PrimaryColorKey>("green");
  const [lang, setLang] = useState<Lang>("zh-CN");
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
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
  }, []);

  // Turnstile site key: 通过运行时 API 获取，避免依赖构建期 NEXT_PUBLIC 注入
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/public-config", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as { turnstileSiteKey?: string };
        if (typeof data.turnstileSiteKey === "string") {
          setTurnstileSiteKey(data.turnstileSiteKey);
        }
      } catch {
        // ignore
      }
    })();
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

  const changeLang = (value: Lang) => {
    setLang(value);
    setLangMenuOpen(false);

    // 将登录页语言切换同步到全局 App 语言（用于后续页面）
    const appLang: AppLanguage = value === "en" ? "en-US" : "zh-CN";
    applyLanguage(appLang);
  };

  const sendEmailCode = async () => {
    setError("");
    setCodeMsg("");

    if (!email) {
      setError(t.errorEmailRequired);
      return;
    }

    if (turnstileLoadFailed || !turnstileSiteKey) {
      setError(t.errorTurnstileLoadFailed);
      return;
    }

    if (!turnstileToken) {
      setError(t.errorTurnstileRequired);
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "user-login", turnstileToken }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || t.errorSendCode);
        return;
      }

      setCodeMsg(t.successCodeSent);
    } catch (error) {
      console.error(error);
      setError(t.errorSendCode);
    } finally {
      setSendingCode(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, emailCode }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setError(text || t.loginError);
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
      className={`auth-page auth-page--split auth-page--vben auth-page--${theme} auth-page--primary-${primary} auth-page--align-right`}
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

              <div className="auth-card__field">
                <div className="auth-card__label">Turnstile</div>
                <div className="auth-card__field-grow">
                  <TurnstileWidget
                    siteKey={turnstileSiteKey}
                    onToken={(token) => {
                      setTurnstileToken(token);
                      setTurnstileLoadFailed(false);
                    }}
                    onError={() => setTurnstileLoadFailed(true)}
                    onExpire={() => setTurnstileToken("")}
                    theme={theme === "dark" ? "dark" : "light"}
                    size="normal"
                  />
                </div>
              </div>

              <label className="auth-card__field">
                <div className="auth-card__field-row auth-card__field-row--label">
                  <span className="auth-card__label">{t.emailCodeLabel}</span>
                  <button
                    type="button"
                    onClick={sendEmailCode}
                    className="auth-card__ghost-button auth-card__ghost-button--link"
                    disabled={sendingCode}
                  >
                    {sendingCode ? t.sendingCodeButton : t.sendCodeButton}
                  </button>
                </div>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t.emailCodePlaceholder}
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  className="auth-card__field-grow"
                  required
                />
                {codeMsg && <div className="auth-card__hint">{codeMsg}</div>}
              </label>

              <button type="submit" className="auth-card__submit-button">
                {t.loginButton}
              </button>
            </form>

            {error && <p className="auth-card__error">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
