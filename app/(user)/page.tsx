"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";

export default function Home() {
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const nickname = window.localStorage.getItem("loggedInUserName");
      const email = window.localStorage.getItem("loggedInUserEmail");
      setDisplayName(nickname || email);
      setUserEmail(email);
    }
  }, []);

  const messages = getUserMessages(language);

  return (
    <div className="home-page">
      {displayName ? (
        <div className="home-card home-card--welcome">
          <h1>{messages.home.welcomeTitle(displayName)}</h1>
          {userEmail && (
            <p className="home-card__subtext">
              {messages.home.currentEmailPrefix}
              {userEmail}
            </p>
          )}
        </div>
      ) : (
        <div className="home-card home-card--guest">
          <h1>{messages.home.guestTitle}</h1>
          <p className="home-card__subtext">
            {messages.home.guestSubtitle}
          </p>
          <div className="home-card__actions">
            <Link href="/login" className="home-card__primary-link">
              {messages.home.loginButton}
            </Link>
            <Link href="/register" className="home-card__secondary-link">
              {messages.home.registerButton}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

