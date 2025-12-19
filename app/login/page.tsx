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
type LoginStep = "email" | "turnstile" | "code";

const TEXTS: Record<Lang, {
  heroTitlePrefix: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  stepEmailTitle: string;
  stepTurnstileTitle: string;
  stepCodeTitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailCodeLabel: string;
  emailCodePlaceholder: string;
  continueButton: string;
  verifyLoading: string;
  submitButton: string;
  useDifferentEmail: string;
  loginError: string;
  errorEmailRequired: string;
  errorTurnstileLoadFailed: string;
  errorSendCode: string;
  errorCodeRequired: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
}> = {
  "zh-CN": {
    heroTitlePrefix: "欢迎回来，",
    heroTitleHighlight: "开始你的控制台之旅",
    heroSubtitle: "工程化 · 高性能 · 深色主题，为大型中后台系统而生。",
    stepEmailTitle: "登录 / 注册",
    stepTurnstileTitle: "人机验证",
    stepCodeTitle: "输入验证码",
    emailLabel: "请输入您的邮箱进行登录或者创建账户",
    emailPlaceholder: "name@example.com",
    emailCodeLabel: "邮箱验证码",
    emailCodePlaceholder: "请输入 6 位验证码",
    continueButton: "登录",
    verifyLoading: "验证中 / 发送验证码中...",
    submitButton: "提交",
    useDifferentEmail: "使用其他邮箱登录",
    loginError: "登录失败，请检查验证码是否正确",
    errorEmailRequired: "请先填写邮箱",
    errorTurnstileLoadFailed: "人机验证加载失败，请刷新页面重试",
    errorSendCode: "发送邮箱验证码失败",
    errorCodeRequired: "请输入邮箱验证码",
    alignLeft: "居左",
    alignCenter: "居中",
    alignRight: "居右",
  },
  en: {
    heroTitlePrefix: "Welcome back,",
    heroTitleHighlight: "start your dashboard journey",
    heroSubtitle: "Engineered, high‑performance dark theme for large admin systems.",
    stepEmailTitle: "Sign in / Sign up",
    stepTurnstileTitle: "Verification",
    stepCodeTitle: "Enter code",
    emailLabel: "Please enter your email to login or create an account",
    emailPlaceholder: "name@example.com",
    emailCodeLabel: "Email code",
    emailCodePlaceholder: "Enter the 6-digit code",
    continueButton: "Continue",
    verifyLoading: "Verifying / sending code...",
    submitButton: "Submit",
    useDifferentEmail: "Sign in with a different email",
    loginError: "Sign-in failed. Please check the code.",
    errorEmailRequired: "Please enter your email first",
    errorTurnstileLoadFailed: "Verification failed to load. Please refresh and try again.",
    errorSendCode: "Failed to send email code",
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
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoadFailed, setTurnstileLoadFailed] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [lastSentToken, setLastSentToken] = useState("");
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

  const sendLoginEmailCode = async (token: string) => {
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

    setSendingCode(true);
    try {
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "user-login", turnstileToken: token }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || t.errorSendCode);
        return;
      }

      // 不展示任何提示文案（按需求“无需提示”）
      setStep("code");
    } catch (error) {
      console.error(error);
      setError(t.errorSendCode);
    } finally {
      setSendingCode(false);
    }
  };

  // Turnstile 成功后自动发送验证码（仅在 turnstile 步骤）
  useEffect(() => {
    if (step !== "turnstile") return;
    if (!turnstileToken) return;
    if (turnstileToken === lastSentToken) return;

    setLastSentToken(turnstileToken);
    void sendLoginEmailCode(turnstileToken);
  }, [lastSentToken, step, turnstileToken]);

  const resetToEmailStep = () => {
    setStep("email");
    setEmail("");
    setEmailCode("");
    setCodeMsg("");
    setTurnstileToken("");
    setLastSentToken("");
    setTurnstileLoadFailed(false);
    setSendingCode(false);
    setError("");
  };

  const startVerification = () => {
    setError("");
    setCodeMsg("");
    setEmailCode("");

    if (!email) {
      setError(t.errorEmailRequired);
      return;
    }

    if (!turnstileSiteKey) {
      setError(t.errorTurnstileLoadFailed);
      return;
    }

    setTurnstileToken("");
    setLastSentToken("");
    setTurnstileLoadFailed(false);
    setStep("turnstile");
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!emailCode) {
      setError(t.errorCodeRequired);
      return;
    }

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

  const handleSubmit = (e: React.FormEvent) => {
    if (step === "code") {
      void submitLogin(e);
      return;
    }
    e.preventDefault();
    if (step === "email") {
      startVerification();
    }
  };

  const headerTitle =
    step === "email"
      ? t.stepEmailTitle
      : step === "turnstile"
        ? t.stepTurnstileTitle
        : t.stepCodeTitle;

  return (
    <div
      className={`auth-page auth-page--split auth-page--vben auth-page--canvas auth-page--${theme} auth-page--primary-${primary} auth-page--align-right`}
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
            <h1 className="auth-page__title">
              {t.heroTitlePrefix}
              <span className="auth-page__title-highlight">{t.heroTitleHighlight}</span>
            </h1>
            <p className="auth-page__subtitle">{t.heroSubtitle}</p>

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
          <div className="auth-plain">
            {/* 邮箱 / 验证码页保留必要提示；人机验证页不提示 */}
            {step !== "turnstile" && (
              <h1 className="auth-plain__title">{headerTitle}</h1>
            )}

            <form onSubmit={handleSubmit} className="auth-card__form" aria-label={headerTitle}>
              {step === "email" && (
                <>
                  <div className="auth-plain__hint">{t.emailLabel}</div>
                  <label className="auth-card__field">
                    <input
                      type="email"
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-label={t.emailLabel}
                      required
                    />
                  </label>

                  <button type="submit" className="auth-card__submit-button">
                    {t.continueButton}
                  </button>
                </>
              )}

              {step === "turnstile" && (
                <>
                  <div className="auth-card__field">
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
                </>
              )}

              {step === "code" && (
                <>
                  <div className="auth-plain__hint">{t.emailCodeLabel}</div>
                  <label className="auth-card__field">
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={t.emailCodePlaceholder}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      className="auth-card__field-grow"
                      aria-label={t.emailCodeLabel}
                      required
                    />
                  </label>

                  <button type="submit" className="auth-card__submit-button">
                    {t.submitButton}
                  </button>

                  <button
                    type="button"
                    className="auth-plain__switch-email"
                    onClick={resetToEmailStep}
                  >
                    {t.useDifferentEmail}
                  </button>
                </>
              )}
            </form>

            {error && <p className="auth-card__error">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
