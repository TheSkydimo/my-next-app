"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TurnstileWidget } from "../components/TurnstileWidget";
import {
  applyTheme,
  getInitialLanguage,
  getInitialTheme,
  type AppLanguage,
  type AppTheme,
} from "../client-prefs";

type Lang = "zh-CN" | "en";

const TEXTS: Record<
  Lang,
  {
    title: string;
    emailPlaceholder: string;
    emailCodePlaceholder: string;
    sendCodeButton: string;
    sendingCodeButton: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    turnstileLabel: string;
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
  }
> = {
  "zh-CN": {
    title: "用户注册",
    emailPlaceholder: "邮箱",
    emailCodePlaceholder: "邮箱验证码",
    sendCodeButton: "获取邮箱验证码",
    sendingCodeButton: "发送中...",
    passwordPlaceholder: "密码",
    confirmPasswordPlaceholder: "确认密码",
    turnstileLabel: "人机验证",
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
  },
  en: {
    title: "Sign up",
    emailPlaceholder: "Email",
    emailCodePlaceholder: "Email code",
    sendCodeButton: "Send email code",
    sendingCodeButton: "Sending...",
    passwordPlaceholder: "Password",
    confirmPasswordPlaceholder: "Confirm password",
    turnstileLabel: "Human verification",
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
  },
};

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoadFailed, setTurnstileLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [lang, setLang] = useState<Lang>("zh-CN");

  const t = TEXTS[lang];
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  // 同步全局主题
  useEffect(() => {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const initialLang: AppLanguage =
      typeof window === "undefined" ? "zh-CN" : getInitialLanguage();
    setLang(initialLang === "en-US" ? "en" : "zh-CN");
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

    if (!siteKey) {
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
    <div className={`auth-page auth-page--${theme}`}>
      <div className="auth-card">
        <h1>{t.title}</h1>

        <form onSubmit={submit} className="auth-card__form">
          <input
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

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

          <div className="auth-card__field-row">
            <div className="auth-card__field-grow">
              <div style={{ marginBottom: 6, fontSize: 13, opacity: 0.9 }}>
                {t.turnstileLabel}
              </div>
              <TurnstileWidget
                siteKey={siteKey}
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

        {error && <p className="auth-card__error">{error}</p>}
        {codeMsg && <p className="auth-card__success">{codeMsg}</p>}
        {ok && (
          <p className="auth-card__success">{t.successRegister}</p>
        )}

        <div className="auth-card__links">
          <p>
            {/* 简单的已有账号提示，复用登录页的链接样式 */}
            <span>
              {lang === "zh-CN" ? "已有账号？" : "Already have an account?"}
            </span>{" "}
            <Link href="/login">
              {lang === "zh-CN" ? "去登录" : "Go to login"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
