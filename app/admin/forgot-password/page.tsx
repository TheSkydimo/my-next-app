"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TurnstileWidget } from "../../components/TurnstileWidget";
import type { AppLanguage, AppTheme } from "../../client-prefs";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  getInitialTheme,
} from "../../client-prefs";

type Lang = "zh-CN" | "en";

const TEXTS: Record<
  Lang,
  {
    title: string;
    backToLoginPrefix: string;
    backToLoginLink: string;
    emailPlaceholder: string;
    emailCodePlaceholder: string;
    sendCodeButton: string;
    sendingCodeButton: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    submitButton: string;
    errorEmailRequired: string;
    errorAllRequired: string;
    errorPasswordMismatch: string;
    errorTurnstileRequired: string;
    errorTurnstileLoadFailed: string;
    errorSendCode: string;
    successCodeSent: string;
    errorResetFailed: string;
    successReset: string;
    showPassword: string;
    hidePassword: string;
  }
> = {
  "zh-CN": {
    title: "管理员忘记密码",
    backToLoginPrefix: "返回管理员登录：",
    backToLoginLink: "管理员登录",
    emailPlaceholder: "管理员邮箱",
    emailCodePlaceholder: "邮箱验证码",
    sendCodeButton: "获取邮箱验证码",
    sendingCodeButton: "发送中...",
    passwordPlaceholder: "新密码",
    confirmPasswordPlaceholder: "确认新密码",
    submitButton: "重置管理员密码",
    errorEmailRequired: "请先填写管理员邮箱",
    errorAllRequired: "请完整填写所有字段（包括邮箱验证码）",
    errorPasswordMismatch: "两次输入的密码不一致",
    errorTurnstileRequired: "请完成人机验证后再获取验证码",
    errorTurnstileLoadFailed: "人机验证加载失败，请刷新页面重试",
    errorSendCode: "发送邮箱验证码失败",
    successCodeSent: "验证码已发送到管理员邮箱，请注意查收",
    errorResetFailed: "重置管理员密码失败",
    successReset: "密码重置成功，即将跳转到管理员登录页…",
    showPassword: "显示",
    hidePassword: "隐藏",
  },
  en: {
    title: "Admin password reset",
    backToLoginPrefix: "Back to admin login: ",
    backToLoginLink: "Admin login",
    emailPlaceholder: "Admin email",
    emailCodePlaceholder: "Email code",
    sendCodeButton: "Send email code",
    sendingCodeButton: "Sending...",
    passwordPlaceholder: "New password",
    confirmPasswordPlaceholder: "Confirm new password",
    submitButton: "Reset admin password",
    errorEmailRequired: "Please enter the admin email first",
    errorAllRequired: "Please fill in all fields (including email code).",
    errorPasswordMismatch: "The two passwords do not match",
    errorTurnstileRequired: "Please complete verification before sending code",
    errorTurnstileLoadFailed: "Verification failed to load. Please refresh.",
    errorSendCode: "Failed to send email code",
    successCodeSent: "Verification code has been sent to the admin email",
    errorResetFailed: "Failed to reset admin password",
    successReset: "Password reset successfully. Redirecting to admin login…",
    showPassword: "Show",
    hidePassword: "Hide",
  },
};

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoadFailed, setTurnstileLoadFailed] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileRenderKey, setTurnstileRenderKey] = useState(0);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [lang, setLang] = useState<Lang>("zh-CN");

  const t = TEXTS[lang];

  useEffect(() => {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const initialLang: AppLanguage =
      typeof window === "undefined" ? "zh-CN" : getInitialLanguage();
    setLang(initialLang === "en-US" ? "en" : "zh-CN");
    applyLanguage(initialLang);
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

  const toggleLanguage = () => {
    setLang((prev) => {
      const nextLang: Lang = prev === "zh-CN" ? "en" : "zh-CN";
      const appLang: AppLanguage = nextLang === "en" ? "en-US" : "zh-CN";
      applyLanguage(appLang);
      return nextLang;
    });
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
        body: JSON.stringify({ email, purpose: "admin-forgot", turnstileToken }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || t.errorSendCode);
        return;
      }

      setCodeMsg(t.successCodeSent);
      setTurnstileToken("");
      setTurnstileRenderKey((v) => v + 1);
    } catch {
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

    const res = await fetch("/api/admin/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, emailCode }),
    });

    if (!res.ok) {
      const text = await res.text();
      setError(text || t.errorResetFailed);
      return;
    }

    setOk(true);
    setTimeout(() => {
      window.location.href = "/admin/login";
    }, 1500);
  };

  return (
    <div className={`auth-page auth-page--${theme}`}>
      <div className="auth-toolbar">
        <div className="auth-toolbar__icon-group">
          <button
            type="button"
            className="auth-toolbar__icon-button"
            onClick={toggleLanguage}
            aria-label={lang === "zh-CN" ? "切换到 English" : "Switch to 中文"}
          >
            {lang === "zh-CN" ? "中" : "EN"}
          </button>
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
      <div className="auth-card">
        <h1>{t.title}</h1>

        <form onSubmit={submit} className="auth-card__form">
          <input
            type="email"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="auth-card__field-row">
            <div className="auth-card__field-grow">
              <TurnstileWidget
                key={turnstileRenderKey}
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

          <div className="auth-card__field-row">
            <input
              placeholder={t.emailCodePlaceholder}
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
              className="auth-card__field-grow"
            />
            <button
              type="button"
              onClick={sendEmailCode}
              disabled={sendingCode}
              className="auth-card__secondary-button"
            >
              {sendingCode ? t.sendingCodeButton : t.sendCodeButton}
            </button>
          </div>

          <div className="auth-card__field-row">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-card__field-grow"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="auth-card__ghost-button"
            >
              {showPassword ? t.hidePassword : t.showPassword}
            </button>
          </div>

          <div className="auth-card__field-row">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder={t.confirmPasswordPlaceholder}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="auth-card__field-grow"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="auth-card__ghost-button"
            >
              {showConfirmPassword ? t.hidePassword : t.showPassword}
            </button>
          </div>

          <button type="submit" className="auth-card__submit-button">
            {t.submitButton}
          </button>
        </form>

        <p className="auth-card__links">
          {t.backToLoginPrefix}
          <Link href="/admin/login">{t.backToLoginLink}</Link>
        </p>

        {error && <p className="auth-card__error">{error}</p>}
        {codeMsg && <p className="auth-card__success">{codeMsg}</p>}
        {ok && (
          <p className="auth-card__success">
            {t.successReset}
          </p>
        )}
      </div>
    </div>
  );
}

