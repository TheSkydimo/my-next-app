"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
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
type AlignMode = "left" | "center" | "right";
type Lang = "zh-CN" | "en";

const TEXTS: Record<
  Lang,
  {
    heroTitlePrefix: string;
    heroTitleHighlight: string;
    heroSubtitle: string;
    welcomeTitle: string;
    welcomeSubtitle: string;
    emailLabel: string;
    title: string;
    emailPlaceholder: string;
    emailCodeLabel: string;
    emailCodePlaceholder: string;
    sendCodeButton: string;
    sendingCodeButton: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    submitButton: string;
    errorEmailRequired: string;
    errorAllRequired: string;
    errorPasswordMismatch: string;
    errorTurnstileRequired: string;
    errorTurnstileLoadFailed: string;
    errorSendCode: string;
    successCodeSent: string;
    errorRegisterFailed: string;
    successRegister: string;
    showPassword: string;
    hidePassword: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    switchTheme: string;
    changePrimary: string;
    changeAlign: string;
    changeLanguage: string;
    toLoginPrefix: string;
    toLoginLink: string;
  }
> = {
  "zh-CN": {
    heroTitlePrefix: "欢迎加入，",
    heroTitleHighlight: "开启你的控制台之旅",
    heroSubtitle: "创建账号后即可使用控制台功能与管理能力。",
    welcomeTitle: "用户注册",
    welcomeSubtitle: "填写信息完成注册（需邮箱验证码与人机验证）。",
    emailLabel: "邮箱",
    title: "用户注册",
    emailPlaceholder: "name@example.com",
    emailCodeLabel: "邮箱验证码",
    emailCodePlaceholder: "邮箱验证码",
    sendCodeButton: "获取邮箱验证码",
    sendingCodeButton: "发送中...",
    passwordLabel: "密码",
    passwordPlaceholder: "密码",
    confirmPasswordLabel: "确认密码",
    confirmPasswordPlaceholder: "确认密码",
    submitButton: "注册",
    errorEmailRequired: "请先填写邮箱",
    errorAllRequired: "请完整填写所有字段（包括邮箱验证码）",
    errorPasswordMismatch: "两次输入的密码不一致",
    errorTurnstileRequired: "请完成人机验证",
    errorTurnstileLoadFailed: "人机验证加载失败，请刷新页面重试",
    errorSendCode: "发送邮箱验证码失败",
    successCodeSent: "验证码已发送到邮箱，请注意查收",
    errorRegisterFailed: "注册失败",
    successRegister: "注册成功，即将跳转到登录页…",
    showPassword: "显示",
    hidePassword: "隐藏",
    alignLeft: "居左",
    alignCenter: "居中",
    alignRight: "居右",
    switchTheme: "切换浅色/深色主题",
    changePrimary: "切换主题主色",
    changeAlign: "切换布局位置",
    changeLanguage: "切换语言",
    toLoginPrefix: "已有账号？",
    toLoginLink: "去登录",
  },
  en: {
    heroTitlePrefix: "Welcome,",
    heroTitleHighlight: "create your account",
    heroSubtitle: "Sign up to start using the dashboard and management features.",
    welcomeTitle: "Sign up",
    welcomeSubtitle: "Complete registration with email code and verification.",
    emailLabel: "Email",
    title: "Sign up",
    emailPlaceholder: "name@example.com",
    emailCodeLabel: "Email code",
    emailCodePlaceholder: "Email code",
    sendCodeButton: "Send email code",
    sendingCodeButton: "Sending...",
    passwordLabel: "Password",
    passwordPlaceholder: "Password",
    confirmPasswordLabel: "Confirm password",
    confirmPasswordPlaceholder: "Confirm password",
    submitButton: "Register",
    errorEmailRequired: "Please enter your email first",
    errorAllRequired: "Please fill in all fields (including email code).",
    errorPasswordMismatch: "The two passwords do not match",
    errorTurnstileRequired: "Please complete the verification",
    errorTurnstileLoadFailed: "Verification failed to load. Please refresh.",
    errorSendCode: "Failed to send email code",
    successCodeSent: "Verification code has been sent to your email",
    errorRegisterFailed: "Registration failed",
    successRegister: "Registration successful. Redirecting to login…",
    showPassword: "Show",
    hidePassword: "Hide",
    alignLeft: "Left",
    alignCenter: "Center",
    alignRight: "Right",
    switchTheme: "Toggle light/dark theme",
    changePrimary: "Change primary color",
    changeAlign: "Change layout alignment",
    changeLanguage: "Change language",
    toLoginPrefix: "Already have an account?",
    toLoginLink: "Go to login",
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

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoadFailed, setTurnstileLoadFailed] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [primary, setPrimary] = useState<PrimaryColorKey>("green");
  const [lang, setLang] = useState<Lang>("zh-CN");
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const t = TEXTS[lang];

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
    const appLang: AppLanguage = value === "en" ? "en-US" : "zh-CN";
    applyLanguage(appLang);
  };

  // 同步全局主题
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const initialLang: AppLanguage =
      typeof window === "undefined" ? "zh-CN" : getInitialLanguage();
    setLang(initialLang === "en-US" ? "en" : "zh-CN");

    const storedPrimary = window.localStorage.getItem("authPrimary") as PrimaryColorKey | null;
    if (storedPrimary && PRIMARY_COLORS.some((c) => c.key === storedPrimary)) {
      setPrimary(storedPrimary);
    }
  }, []);

  const EyeIcon = ({ off }: { off?: boolean }) => {
    // inline svg: avoids adding a dependency
    return off ? (
      <svg
        className="auth-input__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.76-1.76 2-3.56 3.64-5.04" />
        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8-0.52 1.2-1.24 2.42-2.14 3.54" />
        <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
        <path d="M1 1l22 22" />
      </svg>
    ) : (
      <svg
        className="auth-input__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  };

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

  const sendEmailCode = async () => {
    setError("");
    setCodeMsg("");

    if (!email) {
      setError(t.errorEmailRequired);
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "register" }),
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
    setOk(false);

    if (!email || !password || !confirmPassword || !emailCode) {
      setError(t.errorAllRequired);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.errorPasswordMismatch);
      return;
    }

    if (turnstileLoadFailed) {
      setError(t.errorTurnstileLoadFailed);
      return;
    }

    if (!turnstileSiteKey) {
      setError(t.errorTurnstileLoadFailed);
      return;
    }

    if (!turnstileToken) {
      setError(t.errorTurnstileRequired);
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        emailCode,
        turnstileToken,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      setError(text || t.errorRegisterFailed);
      setTurnstileToken("");
      return;
    }

    setOk(true);
    // 注册成功，1.5 秒后跳到登录页
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  };

  return (
    <div
      className={`auth-page auth-page--split auth-page--vben auth-page--${theme} auth-page--primary-${primary} auth-page--align-right`}
    >
      <div className="auth-page__split-shell">
        <div className="auth-toolbar" aria-label={lang === "zh-CN" ? "注册页工具栏" : "Register toolbar"}>
          <div className="auth-toolbar__icon-group">
            <div className="auth-toolbar__icon-wrapper">
              <button
                type="button"
                className="auth-toolbar__icon-button"
                onClick={() => setColorMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={colorMenuOpen}
                aria-label={t.changePrimary}
              >
                🎨
              </button>
              {colorMenuOpen && (
                <div className="auth-toolbar__dropdown auth-toolbar__dropdown--colors">
                  <div className="auth-toolbar__colors" aria-label={t.changePrimary}>
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
                aria-label={t.changeLanguage}
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
              aria-label={t.switchTheme}
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
                  alt={lang === "zh-CN" ? "控制台可视化预览" : "Dashboard preview"}
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
                <span className="auth-card__label">{t.emailCodeLabel}</span>
                <div className="auth-input auth-input--with-suffix">
                  <input
                    placeholder={t.emailCodePlaceholder}
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    required
                  />
                  <div className="auth-input__suffix">
                    <button
                      type="button"
                      onClick={sendEmailCode}
                      disabled={sendingCode}
                      className="auth-input__suffix-button"
                    >
                      {sendingCode ? t.sendingCodeButton : t.sendCodeButton}
                    </button>
                  </div>
                </div>
                {codeMsg && <div className="auth-input__hint">{codeMsg}</div>}
              </label>

              <label className="auth-card__field">
                <span className="auth-card__label">{t.passwordLabel}</span>
                <div className="auth-input auth-input--with-icon">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="auth-input__suffix">
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="auth-input__icon-button"
                      aria-label={showPassword ? t.hidePassword : t.showPassword}
                    >
                      <EyeIcon off={!showPassword} />
                    </button>
                  </div>
                </div>
              </label>

              <label className="auth-card__field">
                <span className="auth-card__label">{t.confirmPasswordLabel}</span>
                <div className="auth-input auth-input--with-icon">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t.confirmPasswordPlaceholder}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <div className="auth-input__suffix">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="auth-input__icon-button"
                      aria-label={showConfirmPassword ? t.hidePassword : t.showPassword}
                    >
                      <EyeIcon off={!showConfirmPassword} />
                    </button>
                  </div>
                </div>
              </label>

              <div className="auth-card__field-row">
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
                  />
                </div>
              </div>

              <button type="submit" className="auth-card__submit-button">
                {t.submitButton}
              </button>
            </form>

            <div className="auth-card__links">
              <p>
                {t.toLoginPrefix} <Link href="/login">{t.toLoginLink}</Link>
              </p>
            </div>

            {error && <p className="auth-card__error">{error}</p>}
            {ok && <p className="auth-card__success">{t.successRegister}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
