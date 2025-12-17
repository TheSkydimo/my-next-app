"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  getInitialTheme,
  type AppLanguage,
  type AppTheme,
} from "../../client-prefs";

type Lang = "zh-CN" | "en";

const TEXTS: Record<
  Lang,
  {
    title: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    loginButton: string;
    forgotPrefix: string;
    forgotLink: string;
    loginError: string;
  }
> = {
  "zh-CN": {
    title: "管理员登录",
    emailPlaceholder: "管理员邮箱",
    passwordPlaceholder: "密码",
    showPassword: "显示",
    hidePassword: "隐藏",
    loginButton: "登录后台",
    forgotPrefix: "忘记管理员密码？",
    forgotLink: "找回密码",
    loginError: "管理员邮箱或密码错误",
  },
  en: {
    title: "Admin sign in",
    emailPlaceholder: "Admin email",
    passwordPlaceholder: "Password",
    showPassword: "Show",
    hidePassword: "Hide",
    loginButton: "Sign in to admin",
    forgotPrefix: "Forgot admin password?",
    forgotLink: "Recover password",
    loginError: "Incorrect admin email or password",
  },
};

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError(t.loginError);
      return;
    }

    const data = (await res.json()) as {
      ok: boolean;
      admin: {
        username: string;
        email: string;
        role?: string;
        isSuperAdmin?: boolean;
      };
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem("adminEmail", data.admin.email);
      window.localStorage.setItem("adminName", data.admin.username);
      window.localStorage.setItem("isAdmin", "true");
      if (data.admin.role) {
        window.localStorage.setItem("adminRole", data.admin.role);
      } else if (data.admin.isSuperAdmin) {
        window.localStorage.setItem("adminRole", "super_admin");
      } else {
        window.localStorage.setItem("adminRole", "admin");
      }
    }

    window.location.href = "/admin";
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
              className="auth-card__ghost-button auth-card__ghost-button--link"
            >
              {showPassword ? t.hidePassword : t.showPassword}
            </button>
          </div>

          <button type="submit" className="auth-card__submit-button">
            {t.loginButton}
          </button>
        </form>

        <div className="auth-card__links">
          <p>
            {t.forgotPrefix}{" "}
            <Link href="/admin/forgot-password">{t.forgotLink}</Link>
          </p>
        </div>

        {error && <p className="auth-card__error">{error}</p>}
      </div>
    </div>
  );
}

