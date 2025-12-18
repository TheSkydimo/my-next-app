"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";
import { useOptionalUser } from "../contexts/UserContext";

export default function Home() {
  // 使用 UserContext 获取预加载的用户信息
  const userContext = useOptionalUser();
  const displayName = userContext?.profile?.username ?? userContext?.profile?.email ?? null;
  const userEmail = userContext?.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialLang = getInitialLanguage();
    setLanguage(initialLang);

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) {
        setLanguage(custom.detail.language);
      }
    };

    window.addEventListener("app-language-changed", handler as EventListener);
    return () => {
      window.removeEventListener(
        "app-language-changed",
        handler as EventListener
      );
    };
  }, []);

  const messages = getUserMessages(language);

  // 与管理端保持一致：已登录用户的欢迎信息采用简单文本布局，不再使用块状卡片
  if (displayName) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.home.welcomeTitle(displayName)}</h1>
          {userEmail && (
            <p className="vben-page__subtitle">
              {messages.home.currentEmailPrefix}
              {userEmail}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 未登录用户仍然保留原来的炫酷卡片样式
  return (
    <div className="home-page">
      <div className="home-card home-card--guest">
        <h1>{messages.home.guestTitle}</h1>
        <p className="home-card__subtext">{messages.home.guestSubtitle}</p>
        <div className="home-card__actions">
          <Link href="/login" className="home-card__primary-link">
            {messages.home.loginButton}
          </Link>
          <Link href="/register" className="home-card__secondary-link">
            {messages.home.registerButton}
          </Link>
        </div>
      </div>
    </div>
  );
}

