"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { TurnstileWidget } from "./TurnstileWidget";
import { useAutoDismissMessage } from "../hooks/useAutoDismissMessage";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  type AppLanguage,
  type AppTheme,
} from "../client-prefs";

type PrimaryColorKey =
  | "charcoal"
  | "blue"
  | "purple"
  | "magenta"
  | "gold"
  | "green"
  | "gray";
type Lang = "zh-CN" | "en";
type LoginStep = "email" | "turnstile" | "code";
type AuthLayoutAlign = "left" | "center" | "right";

type Variant = "user" | "admin";

const TEXTS: Record<
  Variant,
  Record<
    Lang,
    {
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
      rememberMe: string;
      loginError: string;
      errorEmailRequired: string;
      errorTurnstileLoadFailed: string;
      errorSendCode: string;
      errorCodeRequired: string;
      alignLeft: string;
      alignCenter: string;
      alignRight: string;
    }
  >
> = {
  user: {
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
      rememberMe: "记住登录",
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
      heroSubtitle:
        "Engineered, high‑performance dark theme for large admin systems.",
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
      rememberMe: "Remember me",
      loginError: "Sign-in failed. Please check the code.",
      errorEmailRequired: "Please enter your email first",
      errorTurnstileLoadFailed:
        "Verification failed to load. Please refresh and try again.",
      errorSendCode: "Failed to send email code",
      errorCodeRequired: "Please enter the email code",
      alignLeft: "Left",
      alignCenter: "Center",
      alignRight: "Right",
    },
  },
  admin: {
    "zh-CN": {
      heroTitlePrefix: "管理员登录，",
      heroTitleHighlight: "进入后台管理",
      heroSubtitle: "同客户端一致：邮箱验证码登录 + Session Cookie。",
      stepEmailTitle: "管理员登录",
      stepTurnstileTitle: "人机验证",
      stepCodeTitle: "输入验证码",
      emailLabel: "请输入管理员邮箱获取验证码",
      emailPlaceholder: "admin@example.com",
      emailCodeLabel: "邮箱验证码",
      emailCodePlaceholder: "请输入 6 位验证码",
      continueButton: "发送验证码",
      verifyLoading: "验证中 / 发送验证码中...",
      submitButton: "登录后台",
      useDifferentEmail: "使用其他邮箱登录",
      rememberMe: "记住登录",
      loginError: "登录失败，请检查验证码是否正确或账号是否为管理员",
      errorEmailRequired: "请先填写管理员邮箱",
      errorTurnstileLoadFailed: "人机验证加载失败，请刷新页面重试",
      errorSendCode: "发送邮箱验证码失败",
      errorCodeRequired: "请输入邮箱验证码",
      alignLeft: "居左",
      alignCenter: "居中",
      alignRight: "居右",
    },
    en: {
      heroTitlePrefix: "Admin sign in,",
      heroTitleHighlight: "enter the admin console",
      heroSubtitle: "Same as user: email code + session cookie.",
      stepEmailTitle: "Admin sign in",
      stepTurnstileTitle: "Verification",
      stepCodeTitle: "Enter code",
      emailLabel: "Enter admin email to receive a sign-in code",
      emailPlaceholder: "admin@example.com",
      emailCodeLabel: "Email code",
      emailCodePlaceholder: "Enter the 6-digit code",
      continueButton: "Send code",
      verifyLoading: "Verifying / sending code...",
      submitButton: "Sign in",
      useDifferentEmail: "Use a different email",
      rememberMe: "Remember me",
      loginError: "Sign-in failed. Check the code or admin access.",
      errorEmailRequired: "Please enter admin email first",
      errorTurnstileLoadFailed:
        "Verification failed to load. Please refresh and try again.",
      errorSendCode: "Failed to send email code",
      errorCodeRequired: "Please enter the email code",
      alignLeft: "Left",
      alignCenter: "Center",
      alignRight: "Right",
    },
  },
};

const PRIMARY_COLORS: { key: PrimaryColorKey; color: string }[] = [
  { key: "charcoal", color: "#1A1A1A" },
  { key: "blue", color: "#3b82f6" },
  { key: "purple", color: "#8b5cf6" },
  { key: "magenta", color: "#ec4899" },
  { key: "gold", color: "#eab308" },
  { key: "green", color: "#22c55e" },
  { key: "gray", color: "#6b7280" },
];

const PRIMARY_ACCENT: Record<PrimaryColorKey, string> = {
  charcoal: "#1A1A1A",
  blue: "#2563eb",
  purple: "#7c3aed",
  magenta: "#ec4899",
  gold: "#eab308",
  green: "#22c55e",
  gray: "#6b7280",
};

const PRIMARY_SUBMIT_BG: Record<PrimaryColorKey, string> = {
  charcoal: "#1A1A1A",
  blue: "linear-gradient(135deg, #2563eb, #4f46e5)",
  purple: "linear-gradient(135deg, #7c3aed, #a855f7)",
  magenta: "linear-gradient(135deg, #ec4899, #f97316)",
  gold: "linear-gradient(135deg, #eab308, #f97316)",
  green: "linear-gradient(135deg, #10b981, #22c55e)",
  gray: "linear-gradient(135deg, #4b5563, #6b7280)",
};

export function AuthEmailCodePage(props: { variant: Variant }) {
  const { variant } = props;
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeChallengeId, setEmailCodeChallengeId] = useState("");
  const [devEmailCode, setDevEmailCode] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoadFailed, setTurnstileLoadFailed] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileRequired, setTurnstileRequired] = useState(true);
  const [lastSentToken, setLastSentToken] = useState("");
  const [error, setError] = useAutoDismissMessage(2000);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [primary, setPrimary] = useState<PrimaryColorKey>("charcoal");
  const [lang, setLang] = useState<Lang>("zh-CN");
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [layoutAlign, setLayoutAlign] = useState<AuthLayoutAlign>("center");

  const normalizeEmailCode = (raw: string) => raw.replace(/\s+/g, "");

  const t = TEXTS[variant][lang];

  const meEndpoint = variant === "admin" ? "/api/admin/me" : "/api/user/me";
  const loginEndpoint = variant === "admin" ? "/api/admin/login" : "/api/login";
  const emailPurpose = variant === "admin" ? "admin-login" : "user-login";
  const postLoginRedirect = variant === "admin" ? "/admin" : "/";

  // 如果已经有有效 session（cookie），直接跳过邮箱验证
  useEffect(() => {
    if (typeof window === "undefined") return;
    void (async () => {
      try {
        const res = await fetch(meEndpoint, {
          method: "GET",
          credentials: "include",
        });
        if (res.ok) {
          window.location.href = postLoginRedirect;
        }
      } catch {
        // ignore
      }
    })();
  }, [meEndpoint, postLoginRedirect]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 登录页：默认深色主题（仅当用户未设置过全局主题偏好时）
    const storedTheme = window.localStorage.getItem("appTheme") as
      | AppTheme
      | null;
    const initialTheme: AppTheme =
      storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const initialAppLang = getInitialLanguage();
    const initialLang: Lang = initialAppLang === "en-US" ? "en" : "zh-CN";
    setLang(initialLang);

    const storedPrimary = window.localStorage.getItem(
      "authPrimary"
    ) as PrimaryColorKey | null;
    if (storedPrimary && PRIMARY_COLORS.some((c) => c.key === storedPrimary)) {
      setPrimary(storedPrimary);
    }

    const storedAlign = window.localStorage.getItem(
      "authAlign"
    ) as AuthLayoutAlign | null;
    if (
      storedAlign === "left" ||
      storedAlign === "center" ||
      storedAlign === "right"
    ) {
      setLayoutAlign(storedAlign);
    } else {
      // 登录页默认居中布局
      window.localStorage.setItem("authAlign", "center");
    }
  }, []);

  // Turnstile site key: 通过运行时 API 获取，避免依赖构建期 NEXT_PUBLIC 注入
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/public-config", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          turnstileSiteKey?: string;
          turnstileRequired?: boolean;
        };
        if (typeof data.turnstileSiteKey === "string") {
          setTurnstileSiteKey(data.turnstileSiteKey);
          setTurnstileRequired(
            typeof data.turnstileRequired === "boolean"
              ? data.turnstileRequired
              : !!data.turnstileSiteKey
          );
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

  const changeLayoutAlign = (align: AuthLayoutAlign) => {
    setLayoutAlign(align);
    setLayoutMenuOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("authAlign", align);
    }
  };

  const sendLoginEmailCode = useCallback(
    async (token?: string) => {
      setError("");
      setDevEmailCode("");
      setEmailCodeChallengeId("");

      if (!email) {
        setError(t.errorEmailRequired);
        return;
      }

      if (turnstileRequired && (turnstileLoadFailed || !turnstileSiteKey)) {
        setError(t.errorTurnstileLoadFailed);
        return;
      }

      try {
        const res = await fetch("/api/email/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            purpose: emailPurpose,
            language: lang === "en" ? "en-US" : "zh-CN",
            ...(token ? { turnstileToken: token } : {}),
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          setError(text || t.errorSendCode);
          if (!turnstileRequired) setStep("email");
          return;
        }

        const data = (await res.json().catch(() => null)) as
          | { challengeId?: string; devCode?: string }
          | null;

        if (!data?.challengeId) {
          setError(t.errorSendCode);
          if (!turnstileRequired) setStep("email");
          return;
        }

        setEmailCodeChallengeId(String(data.challengeId));
        if (data?.devCode) {
          setDevEmailCode(String(data.devCode));
        }

        // 不展示任何提示文案（按需求“无需提示”）
        setStep("code");
      } catch (error) {
        console.error(error);
        setError(t.errorSendCode);
        if (!turnstileRequired) setStep("email");
      }
    },
    [
      email,
      emailPurpose,
      lang,
      setError,
      t.errorEmailRequired,
      t.errorSendCode,
      t.errorTurnstileLoadFailed,
      turnstileLoadFailed,
      turnstileRequired,
      turnstileSiteKey,
    ]
  );

  // Turnstile 成功后自动发送验证码（仅在 turnstile 步骤）
  useEffect(() => {
    if (step !== "turnstile") return;
    if (!turnstileToken) return;
    if (turnstileToken === lastSentToken) return;

    setLastSentToken(turnstileToken);
    void sendLoginEmailCode(turnstileToken);
  }, [lastSentToken, sendLoginEmailCode, step, turnstileToken]);

  const resetToEmailStep = () => {
    setStep("email");
    setEmail("");
    setEmailCode("");
    setEmailCodeChallengeId("");
    setDevEmailCode("");
    setTurnstileToken("");
    setLastSentToken("");
    setTurnstileLoadFailed(false);
    setError("");
  };

  const startVerification = () => {
    setError("");
    setEmailCode("");
    setEmailCodeChallengeId("");
    setDevEmailCode("");

    if (!email) {
      setError(t.errorEmailRequired);
      return;
    }

    if (turnstileRequired && !turnstileSiteKey) {
      setError(t.errorTurnstileLoadFailed);
      return;
    }

    if (!turnstileRequired) {
      // 本地测试：跳过 Turnstile，直接发送验证码
      void sendLoginEmailCode();
      setStep("code");
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

    const normalizedCode = normalizeEmailCode(emailCode);
    if (!normalizedCode) {
      setError(t.errorCodeRequired);
      return;
    }

    const res = await fetch(loginEndpoint, {
      method: "POST",
      body: JSON.stringify({
        email,
        emailCode: normalizedCode,
        emailCodeChallengeId,
        remember: rememberMe,
      }),
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setError(text || t.loginError);
      return;
    }

    if (variant === "user") {
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
    } else {
      // admin: do not persist admin identity in localStorage; rely on httpOnly cookie.
      await res.json().catch(() => null);
    }

    window.location.href = postLoginRedirect;
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
      className={`auth-page auth-page--split auth-page--vben auth-page--canvas auth-page--${theme} auth-page--primary-${primary} auth-page--align-${layoutAlign}`}
      style={
        {
          // 确保按钮/勾选框“立即”跟随主色变化（避免被 CSS 覆盖或缓存影响）
          "--auth-accent": PRIMARY_ACCENT[primary],
          "--auth-submit-bg": PRIMARY_SUBMIT_BG[primary],
        } as React.CSSProperties
      }
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
                className={`auth-toolbar__icon-button auth-toolbar__icon-button--layout auth-toolbar__icon-button--layout-${layoutAlign}`}
                onClick={() => setLayoutMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={layoutMenuOpen}
                aria-label="切换布局"
                title="切换布局"
              >
                <span className="auth-toolbar__layout-bar auth-toolbar__layout-bar--left" />
                <span className="auth-toolbar__layout-bar auth-toolbar__layout-bar--center" />
                <span className="auth-toolbar__layout-bar auth-toolbar__layout-bar--right" />
              </button>
              {layoutMenuOpen && (
                <div className="auth-toolbar__dropdown">
                  <button
                    type="button"
                    className="auth-toolbar__dropdown-item"
                    onClick={() => changeLayoutAlign("left")}
                  >
                    {t.alignLeft}
                  </button>
                  <button
                    type="button"
                    className="auth-toolbar__dropdown-item"
                    onClick={() => changeLayoutAlign("center")}
                  >
                    {t.alignCenter}
                  </button>
                  <button
                    type="button"
                    className="auth-toolbar__dropdown-item"
                    onClick={() => changeLayoutAlign("right")}
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
            <h1 className="auth-page__title">
              {t.heroTitlePrefix}
              <span className="auth-page__title-highlight">
                {t.heroTitleHighlight}
              </span>
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

            <form
              onSubmit={handleSubmit}
              className="auth-card__form"
              aria-label={headerTitle}
            >
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

                  <label className="auth-plain__remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>{t.rememberMe}</span>
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
                      onChange={(e) => setEmailCode(normalizeEmailCode(e.target.value))}
                      className="auth-card__field-grow"
                      aria-label={t.emailCodeLabel}
                      required
                    />
                  </label>

                  {devEmailCode && (
                    <div className="auth-plain__hint" style={{ marginTop: 6 }}>
                      DEV Code: <strong>{devEmailCode}</strong>
                    </div>
                  )}

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


