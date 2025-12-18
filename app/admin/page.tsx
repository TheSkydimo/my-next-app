"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { getAdminMessages } from "../admin-i18n";
import { useOptionalAdmin } from "../contexts/AdminContext";

export default function AdminHomePage() {
  // 使用 AdminContext 获取预加载的管理员信息
  const adminContext = useOptionalAdmin();
  const adminName = adminContext?.profile?.username ?? null;
  const adminEmail = adminContext?.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");

  const messages = getAdminMessages(language);

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

  if (!adminName) {
    return (
      <div style={{ maxWidth: 640, margin: "10px auto" }}>
        <h1>{messages.home.title}</h1>
        <p>{messages.common.adminLoginRequired}</p>
        <Link href="/admin/login">{messages.common.goAdminLogin}</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "10px auto" }}>
      <h1>{messages.home.title}</h1>
      <p>
        {messages.home.welcomeLabel}
        {adminName}
      </p>
      {adminEmail && (
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          {messages.home.emailLabel}
          {adminEmail}
        </p>
      )}

      {/* 其他功能入口已经在左侧菜单中展示，这里只作为首页展示信息 */}
    </div>
  );
}


