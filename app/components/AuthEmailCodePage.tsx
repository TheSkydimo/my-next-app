"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { TurnstileWidget } from "./TurnstileWidget";
import { TranslateIcon } from "./icons/TranslateIcon";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  type AppLanguage,
  type AppTheme,
} from "../client-prefs";
import {
  ADMIN_BOOTSTRAP_SESSION_STORAGE_KEY,
  USER_BOOTSTRAP_SESSION_STORAGE_KEY,
} from "../contexts/ApiCacheContext";

type PrimaryColorKey =
  | "charcoal"
  | "blue"
  | "purple"
  | "magenta"
  | "gold"
  | "green"
  | "gray";
type Lang = "zh-CN" | "en";
type LoginStep = "turnstile" | "email" | "code";
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
      turnstileNotice: string;
      turnstileVerifying: string;
      turnstileOneClickRetry: string;
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
      errorTurnstileRequired: string;
      errorSendCode: string;
      errorSendCodeHint: string;
      retrySendCode: string;
      reportIssue: string;
      reporting: string;
      reportSent: string;
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
      stepTurnstileTitle: "验证",
      stepCodeTitle: "输入验证码",
      turnstileNotice: "您的连接需要被验证才能继续",
      turnstileVerifying: "验证中…",
      turnstileOneClickRetry:
        "当前验证需要“一键验证”。请稍后再试（2 秒后将返回人机验证并重新开始）。",
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
      errorTurnstileLoadFailed: "验证加载失败，请刷新页面重试",
      errorTurnstileRequired: "请先完成验证",
      errorSendCode: "发送邮箱验证码失败",
      errorSendCodeHint: "你可以点击重试；若多次失败，可一键反馈给开发者以便尽快排查。",
      retrySendCode: "重试",
      reportIssue: "一键反馈",
      reporting: "反馈中...",
      reportSent: "反馈已提交，感谢！",
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
      turnstileNotice: "Your connection needs to be verified before you can proceed.",
      turnstileVerifying: "Verifying…",
      turnstileOneClickRetry:
        "This verification requires an interactive check. Please try again later (returning to verification in 2s).",
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
      errorTurnstileRequired: "Please complete the verification first.",
      errorSendCode: "Failed to send email code",
      errorSendCodeHint:
        "You can retry. If it still fails, send a quick report to help us diagnose the issue.",
      retrySendCode: "Retry",
      reportIssue: "Report",
      reporting: "Reporting...",
      reportSent: "Report submitted. Thanks!",
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
      stepTurnstileTitle: "验证",
      stepCodeTitle: "输入验证码",
      turnstileNotice: "您的连接需要被验证才能继续。",
      turnstileVerifying: "验证中…",
      turnstileOneClickRetry:
        "当前验证需要“一键验证”。请稍后再试（2 秒后将返回人机验证并重新开始）。",
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
      errorTurnstileLoadFailed: "验证加载失败，请刷新页面重试",
      errorTurnstileRequired: "请先完成验证",
      errorSendCode: "发送邮箱验证码失败",
      errorSendCodeHint: "你可以点击重试；若多次失败，可一键反馈给开发者以便尽快排查。",
      retrySendCode: "重试",
      reportIssue: "一键反馈",
      reporting: "反馈中...",
      reportSent: "反馈已提交，感谢！",
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
      turnstileNotice: "Your connection needs to be verified before you can proceed.",
      turnstileVerifying: "Verifying…",
      turnstileOneClickRetry:
        "This verification requires an interactive check. Please try again later (returning to verification in 2s).",
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
      errorTurnstileRequired: "Please complete the verification first.",
      errorSendCode: "Failed to send email code",
      errorSendCodeHint:
        "You can retry. If it still fails, send a quick report to help us diagnose the issue.",
      retrySendCode: "Retry",
      reportIssue: "Report",
      reporting: "Reporting...",
      reportSent: "Report submitted. Thanks!",
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
  const [turnstilePassed, setTurnstilePassed] = useState(false);
  const [verifyingTurnstile, setVerifyingTurnstile] = useState(false);
  const [turnstileResetNonce, setTurnstileResetNonce] = useState(0);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<
    "none" | "send-code" | "login" | "validation" | "turnstile" | "other"
  >("none");
  const [sendCodeFailedCount, setSendCodeFailedCount] = useState(0);
  const [sendCodeRequestId, setSendCodeRequestId] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportOk, setReportOk] = useState(false);
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
  const userBootstrapEndpoint =
    variant === "user" ? "/api/user/dashboard-bootstrap" : null;
  const adminBootstrapEndpoint =
    variant === "admin" ? "/api/admin/dashboard-bootstrap" : null;
  const sendCodeStage = useMemo(() => {
    if (variant === "admin") return "admin-login:send-code" as const;
    return "user-login:send-code" as const;
  }, [variant]);

  const canShowReport = sendCodeFailedCount >= 2;
  const emailPrimaryMode: "send" | "retry" | "report" = canShowReport
    ? "report"
    : sendCodeFailedCount >= 1
      ? "retry"
      : "send";

  const errorKindRef = useRef(errorKind);
  useEffect(() => {
    errorKindRef.current = errorKind;
  }, [errorKind]);

  const turnstileRestartTimerRef = useRef<number | null>(null);
  const interactiveHandledRef = useRef(false);
  useEffect(() => {
    return () => {
      if (turnstileRestartTimerRef.current) {
        window.clearTimeout(turnstileRestartTimerRef.current);
        turnstileRestartTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Reset "retry / report" state when switching recipient email.
    setSendCodeFailedCount(0);
    setSendCodeRequestId(null);
    setReportOk(false);
    if (errorKindRef.current === "send-code") {
      setError("");
      setErrorKind("none");
    }
  }, [email]);

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

  // Initial step: Turnstile (if required) -> Email -> Code
  useEffect(() => {
    // Wait for config to load (turnstileRequired defaults to true, so only switch
    // once we have a decision).
    if (turnstileRequired) {
      setStep("turnstile");
    } else {
      setStep("email");
    }
  }, [turnstileRequired]);

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
    async () => {
      setError("");
      setErrorKind("none");
      setReportOk(false);
      setDevEmailCode("");
      setEmailCodeChallengeId("");
      setSendCodeRequestId(null);

      if (!email) {
        setError(t.errorEmailRequired);
        setErrorKind("validation");
        return;
      }

      if (turnstileRequired && !turnstilePassed) {
        // Enforce flow: Turnstile -> Email -> Code (no skipping).
        setStep("turnstile");
        setError(t.errorTurnstileRequired);
        setErrorKind("turnstile");
        return;
      }

      setSendingCode(true);
      try {
        const res = await fetch("/api/email/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            purpose: emailPurpose,
            language: lang === "en" ? "en-US" : "zh-CN",
          }),
        });

        const rid = res.headers.get("x-request-id");
        setSendCodeRequestId(rid ? String(rid) : null);

        if (!res.ok) {
          const text = await res.text();
          setError(text || t.errorSendCode);
          setErrorKind("send-code");
          setSendCodeFailedCount((c) => c + 1);
          return;
        }

        const data = (await res.json().catch(() => null)) as
          | { challengeId?: string; devCode?: string }
          | null;

        if (!data?.challengeId) {
          setError(t.errorSendCode);
          setErrorKind("send-code");
          setSendCodeFailedCount((c) => c + 1);
          return;
        }

        setEmailCodeChallengeId(String(data.challengeId));
        if (data?.devCode) {
          setDevEmailCode(String(data.devCode));
        }

        // 不展示任何提示文案（按需求“无需提示”）
        setStep("code");
        setSendCodeFailedCount(0);
      } catch {
        // Avoid dumping raw errors that may include request internals; keep UI message friendly.
        console.error("发送邮箱验证码失败");
        setError(t.errorSendCode);
        setErrorKind("send-code");
        setSendCodeFailedCount((c) => c + 1);
      } finally {
        setSendingCode(false);
      }
    },
    [
      email,
      emailPurpose,
      lang,
      t.errorEmailRequired,
      t.errorSendCode,
      turnstileRequired,
      turnstilePassed,
      t.errorTurnstileRequired,
    ]
  );

  const resetToEmailStep = () => {
    setStep("email");
    setEmail("");
    setEmailCode("");
    setEmailCodeChallengeId("");
    setDevEmailCode("");
    setTurnstileLoadFailed(false);
    setError("");
    setErrorKind("none");
    setSendCodeFailedCount(0);
    setSendCodeRequestId(null);
    setReportOk(false);
    // Keep the "Turnstile passed" state: user may switch emails and retry without
    // being forced back to the Turnstile page (human verification is done once).
  };

  const restartTurnstileFlow = useCallback(
    (message: string) => {
      // Avoid repeated triggers from the widget.
      if (interactiveHandledRef.current) return;
      interactiveHandledRef.current = true;

      setError(message);
      setErrorKind("turnstile");
      setVerifyingTurnstile(false);
      setTurnstileToken("");
      setTurnstilePassed(false);
      setStep("turnstile");

      if (turnstileRestartTimerRef.current) {
        window.clearTimeout(turnstileRestartTimerRef.current);
        turnstileRestartTimerRef.current = null;
      }

      turnstileRestartTimerRef.current = window.setTimeout(() => {
        // Back to the human verification step and restart the widget.
        setError("");
        setErrorKind("none");
        setTurnstileToken("");
        setTurnstileLoadFailed(false);
        setVerifyingTurnstile(false);
        setTurnstilePassed(false);
        setStep("turnstile");
        setTurnstileResetNonce((n) => n + 1);
        interactiveHandledRef.current = false;
      }, 2000);
    },
    []
  );

  const startSendCode = () => {
    setError("");
    setErrorKind("none");
    setEmailCode("");
    setEmailCodeChallengeId("");
    setDevEmailCode("");

    if (!email) {
      setError(t.errorEmailRequired);
      setErrorKind("validation");
      return;
    }

    // Email step only: Turnstile is handled earlier (and only once).
    void sendLoginEmailCode();
  };

  const verifyTurnstileAndContinue = useCallback(async (token: string) => {
    setError("");
    setErrorKind("none");

    if (!turnstileRequired) {
      setTurnstilePassed(true);
      setStep("email");
      return;
    }

    if (turnstileLoadFailed || !turnstileSiteKey) {
      setError(t.errorTurnstileLoadFailed);
      setErrorKind("turnstile");
      return;
    }

    if (!token) return;
    if (verifyingTurnstile || turnstilePassed) return;

    setVerifyingTurnstile(true);
    try {
      const res = await fetch("/api/turnstile/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });

      if (!res.ok) {
        // 用户侧表现：提示稍后再试，并自动回到人机验证页面重新开始
        // （避免在 Turnstile “一键验证/交互”或网络抖动时卡死在当前状态）
        await res.text().catch(() => "");
        restartTurnstileFlow(t.turnstileOneClickRetry);
        return;
      }

      setTurnstilePassed(true);
      // Do not reset Turnstile on success; user won't come back here unless they restart.
      setStep("email");
    } catch {
      restartTurnstileFlow(t.turnstileOneClickRetry);
    } finally {
      setVerifyingTurnstile(false);
    }
  }, [
    t.errorTurnstileLoadFailed,
    t.turnstileOneClickRetry,
    restartTurnstileFlow,
    turnstileLoadFailed,
    turnstilePassed,
    turnstileRequired,
    turnstileSiteKey,
    verifyingTurnstile,
  ]);

  // Auto continue: once the user checks Turnstile and we get a token, verify server-side
  // and proceed to the email(login/register) step. No button required.
  useEffect(() => {
    if (step !== "turnstile") return;

    if (!turnstileRequired) {
      if (!turnstilePassed) setTurnstilePassed(true);
      setStep("email");
      return;
    }

    if (!turnstileToken) return;
    if (turnstileLoadFailed || !turnstileSiteKey) return;
    if (verifyingTurnstile || turnstilePassed) return;

    void verifyTurnstileAndContinue(turnstileToken);
  }, [
    step,
    turnstileRequired,
    turnstileToken,
    turnstileLoadFailed,
    turnstileSiteKey,
    verifyingTurnstile,
    turnstilePassed,
    verifyTurnstileAndContinue,
  ]);

  const submitAuthErrorReport = async () => {
    if (reporting || !email) return;
    setReporting(true);
    setReportOk(false);
    try {
      const composed =
        `用户在登录时验证码发送失败，请检查并修复。\n\n` +
        `用户邮箱: ${email}\n` +
        `阶段: ${sendCodeStage}\n` +
        `页面: ${typeof window !== "undefined" ? window.location.pathname : ""}\n` +
        `X-Request-Id: ${sendCodeRequestId || ""}\n` +
        `错误信息: ${error || t.errorSendCode}\n` +
        `时间: ${new Date().toISOString()}\n`;

      const res = await fetch("/api/feedback/auth-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          stage: sendCodeStage,
          message: composed,
          requestId: sendCodeRequestId || undefined,
          pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "发送失败，请稍后再试");
      }

      setReportOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败，请稍后再试");
    } finally {
      setReporting(false);
    }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorKind("none");

    const normalizedCode = normalizeEmailCode(emailCode);
    if (!normalizedCode) {
      setError(t.errorCodeRequired);
      setErrorKind("validation");
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
      setErrorKind("login");
      return;
    }

    if (variant === "user") {
      // Response body is not needed here (auth is via httpOnly cookie).
      await res.json().catch(() => null);

      // 安全：不要把邮箱/头像等用户信息持久化写入 localStorage（避免 XSS/共享设备泄露）

      // 登录成功：预加载用户端 Dashboard 核心数据，并写入 sessionStorage（一次性）
      // 注意：这里不引入第三方状态库，不改现有页面逻辑，只是“暖缓存”让后续页面优先命中。
      if (typeof window !== "undefined" && userBootstrapEndpoint) {
        try {
          const ctrl = new AbortController();
          const timeout = window.setTimeout(() => ctrl.abort(), 1500);
          const pre = await fetch(userBootstrapEndpoint, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: ctrl.signal,
          }).finally(() => window.clearTimeout(timeout));

          if (pre.ok) {
            const payload = await pre.json().catch(() => null);
            if (payload && typeof payload === "object") {
              window.sessionStorage.setItem(
                USER_BOOTSTRAP_SESSION_STORAGE_KEY,
                JSON.stringify(payload)
              );
            }
          }
        } catch {
          // best-effort: ignore preload failure
        }
      }
    } else {
      // admin: do not persist admin identity in localStorage; rely on httpOnly cookie.
      await res.json().catch(() => null);

      // 管理端：登录成功后预加载一次核心列表数据，并写入 sessionStorage（一次性）
      if (typeof window !== "undefined" && adminBootstrapEndpoint) {
        try {
          const ctrl = new AbortController();
          const timeout = window.setTimeout(() => ctrl.abort(), 1500);
          const pre = await fetch(adminBootstrapEndpoint, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: ctrl.signal,
          }).finally(() => window.clearTimeout(timeout));

          if (pre.ok) {
            const payload = await pre.json().catch(() => null);
            if (payload && typeof payload === "object") {
              window.sessionStorage.setItem(
                ADMIN_BOOTSTRAP_SESSION_STORAGE_KEY,
                JSON.stringify(payload)
              );
            }
          }
        } catch {
          // best-effort: ignore preload failure
        }
      }
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
      if (emailPrimaryMode === "report") {
        void submitAuthErrorReport();
        return;
      }
      startSendCode();
    }
  };

  // Turnstile step: do not show a big title.
  const headerTitle =
    step === "turnstile"
      ? ""
      : step === "email"
        ? t.stepEmailTitle
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
                <TranslateIcon className="auth-toolbar__icon-svg" size={16} />
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
            {!!headerTitle && <h1 className="auth-plain__title">{headerTitle}</h1>}

            <form
              onSubmit={handleSubmit}
              className="auth-card__form"
              aria-label={headerTitle}
            >
              {step === "turnstile" && (
                <>
                  <div
                    className="auth-plain__hint"
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: 0.2,
                    }}
                  >
                    {t.turnstileNotice}
                  </div>

                  {turnstileRequired && (
                    <div className="auth-card__field" style={{ marginTop: 8 }}>
                      <div className="auth-card__field-grow">
                        <TurnstileWidget
                          siteKey={turnstileSiteKey}
                          onToken={(token) => {
                            setTurnstileToken(token);
                            setTurnstileLoadFailed(false);
                            if (errorKind === "turnstile") {
                              setError("");
                              setErrorKind("none");
                            }
                          }}
                          onError={() => setTurnstileLoadFailed(true)}
                          onTimeout={() => restartTurnstileFlow(t.turnstileOneClickRetry)}
                          // IMPORTANT: Allow interactive challenges (checkbox / extra steps).
                          // Previously we force-restarted here, which trapped users in a loop.
                          onExpire={() => setTurnstileToken("")}
                          theme={theme === "dark" ? "dark" : "light"}
                          size="normal"
                          resetNonce={turnstileResetNonce}
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="auth-card__error" role="alert" aria-live="polite">
                      <div className="auth-card__error-title">{error}</div>
                    </div>
                  )}
                  {verifyingTurnstile && (
                    <div
                      className="auth-plain__hint"
                      style={{ marginTop: 10, fontSize: 16, fontWeight: 600 }}
                    >
                      {t.turnstileVerifying}
                    </div>
                  )}
                </>
              )}

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

                  {error && (
                    <div className="auth-card__error" role="alert" aria-live="polite">
                      <div className="auth-card__error-title">{error}</div>
                      {errorKind === "send-code" && (
                        <>
                          <div className="auth-card__error-hint">{t.errorSendCodeHint}</div>
                          {sendCodeRequestId && (
                            <div className="auth-card__error-meta">
                              X-Request-Id: <code>{sendCodeRequestId}</code>
                            </div>
                          )}
                        </>
                      )}
                      {reportOk && (
                        <div className="auth-card__error-success">{t.reportSent}</div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="auth-card__submit-button"
                    disabled={sendingCode || reporting}
                  >
                    {emailPrimaryMode === "report"
                      ? reporting
                        ? t.reporting
                        : t.reportIssue
                      : emailPrimaryMode === "retry"
                        ? sendingCode
                          ? t.verifyLoading
                          : t.retrySendCode
                        : sendingCode
                          ? t.verifyLoading
                          : t.continueButton}
                  </button>
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

            {/* code step: keep errors visible below the form */}
            {step === "code" && error && (
              <div className="auth-card__error" role="alert" aria-live="polite">
                <div className="auth-card__error-title">{error}</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


